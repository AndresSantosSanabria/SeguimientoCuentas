package com.sgcc.seguimientocuentas.contratos.application;

import com.sgcc.seguimientocuentas.accesos.domain.model.AmbitoUsuario;
import com.sgcc.seguimientocuentas.common.dto.ContratoResumenDTO;
import com.sgcc.seguimientocuentas.contratos.application.ContratoResumenIndex.Publicacion;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import tools.jackson.databind.ObjectMapper;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.UncheckedIOException;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicReference;
import java.util.concurrent.locks.ReentrantLock;
import java.util.zip.GZIPOutputStream;

/**
 * Serializa el indice en memoria y conserva el resultado mientras la version del indice no se mueva.
 * No consulta la base: el TTL desaparecio, y una rafaga de eventos CDC produce una sola serializacion
 * porque la publicacion se coalesce en una ventana configurable que se estira si serializar tarda.
 * El gzip tambien se hace aqui, una vez por publicacion, para que nginx no comprima 30 MB por usuario.
 *
 * Cuando el acceso es por secretaria la lista se arma aparte: el resultado se cachea por ambito y
 * solo se guarda la version comprimida, porque el texto plano de la lista completa pesa demasiado
 * para multiplicarlo por secretaria.
 */
@Service
public class ContratoResumenCache {

    public record Snapshot(byte[] body, byte[] bodyGzip, String etag, long generadoEn, long version) {}

    /** La lista de una secretaria: solo se conserva comprimida, el texto se rehace si lo piden. */
    public record SnapshotSecretaria(byte[] bodyGzip, String etag, long version) {}
    public record SnapshotUsuario(byte[] body, byte[] bodyGzip, String etag, long version) {}

    private static final Logger log = LoggerFactory.getLogger(ContratoResumenCache.class);

    /** Cuantos ambitos se guardan a la vez; los mas viejos se van cuando se llena. */
    private static final int MAX_AMBITOS = 24;

    private final ContratoResumenIndex indice;
    private final ObjectMapper objectMapper;
    private final long ventanaPublicacionMillis;

    private final AtomicReference<Snapshot> actual = new AtomicReference<>();
    private final Map<String, SnapshotSecretaria> porSecretaria = new ConcurrentHashMap<>();
    private final ReentrantLock lock = new ReentrantLock();
    private volatile long proximaPublicacionPermitida;
    private volatile Publicacion ultimaPublicacion;

    public ContratoResumenCache(ContratoResumenIndex indice,
                                ObjectMapper objectMapper,
                                @Value("${contratos.resumen.publicar-ms:1000}") long ventanaPublicacionMillis) {
        this.indice = indice;
        this.objectMapper = objectMapper;
        this.ventanaPublicacionMillis = ventanaPublicacionMillis;
    }

    public Snapshot obtener() {
        indice.asegurarDia(LocalDate.now());

        Snapshot previa = actual.get();
        if (previa == null) {
            lock.lock();
            try {
                if (actual.get() == null) {
                    publicar();
                }
                return actual.get();
            } finally {
                lock.unlock();
            }
        }

        if (indice.version() <= previa.version() || System.currentTimeMillis() < proximaPublicacionPermitida) {
            return previa;
        }
        if (!lock.tryLock()) {
            return previa;
        }
        try {
            if (indice.version() > actual.get().version()) {
                publicar();
            }
            return actual.get();
        } finally {
            lock.unlock();
        }
    }

    private void publicar() {
        long inicio = System.currentTimeMillis();
        Publicacion publicacion = indice.publicar();
        byte[] body = objectMapper.writeValueAsBytes(publicacion.contratos());
        byte[] bodyGzip = comprimir(body);
        long duracion = System.currentTimeMillis() - inicio;
        proximaPublicacionPermitida = System.currentTimeMillis() + Math.max(ventanaPublicacionMillis, duracion);
        ultimaPublicacion = publicacion;
        actual.set(new Snapshot(body, bodyGzip, etag(body), System.currentTimeMillis(), publicacion.version()));
        log.info("Resumen publicado: {} contratos, {} KB ({} KB gzip), {} ms, version {}",
                publicacion.contratos().size(), body.length / 1024, bodyGzip.length / 1024, duracion,
                publicacion.version());
    }

    /**
     * La lista de los contratos de las secretarias dadas, comprimida y cacheada por ambito.
     *
     * La compresion se hace una vez por ambito, como la de la lista completa: si no, cada usuario
     * que entra pagaria la compresion de su lista.
     */
    public SnapshotSecretaria obtenerSecretarias(Set<String> secretarias) {
        Publicacion publicacion = publicacionVigente();
        String clave = String.join("|", secretarias.stream().sorted().toList());
        SnapshotSecretaria previa = porSecretaria.get(clave);
        if (previa != null && previa.version() >= publicacion.version()) {
            return previa;
        }
        List<ContratoResumenDTO> lista = filtrar(publicacion.contratos(), secretarias);
        byte[] body = objectMapper.writeValueAsBytes(lista);
        byte[] bodyGzip = comprimir(body);
        SnapshotSecretaria nueva = new SnapshotSecretaria(bodyGzip, etag(body), publicacion.version());
        guardarAmbito(clave, nueva, publicacion.version());
        return nueva;
    }

    /** El texto plano de un ambito, para el cliente que no acepta gzip: se rehace en el momento. */
    public byte[] cuerpoSinComprimir(Set<String> secretarias) {
        Publicacion publicacion = publicacionVigente();
        return objectMapper.writeValueAsBytes(filtrar(publicacion.contratos(), secretarias));
    }

    /** Lista privada recortada al contratista que corresponde al perfil BASICO. */
    public SnapshotUsuario obtenerUsuario(Set<String> contratosPermitidos) {
        Publicacion publicacion = publicacionVigente();
        List<ContratoResumenDTO> lista = publicacion.contratos().stream()
                .filter(contrato -> contratosPermitidos.contains(contrato.getNoContrato()))
                .toList();
        byte[] body = objectMapper.writeValueAsBytes(lista);
        return new SnapshotUsuario(body, comprimir(body), etag(body), publicacion.version());
    }

    /** La publicacion que esta vigente: la global primero, para que ambas listas digan lo mismo. */
    private Publicacion publicacionVigente() {
        obtener();
        Publicacion publicacion = ultimaPublicacion;
        if (publicacion == null) {
            publicacion = indice.publicar();
            ultimaPublicacion = publicacion;
        }
        return publicacion;
    }

    private static List<ContratoResumenDTO> filtrar(List<ContratoResumenDTO> contratos, Set<String> secretarias) {
        if (secretarias.isEmpty()) {
            return List.of();
        }
        return contratos.stream()
                .filter(contrato -> secretarias.contains(AmbitoUsuario.normalizar(contrato.getDependencia())))
                .toList();
    }

    private void guardarAmbito(String clave, SnapshotSecretaria snapshot, long version) {
        if (porSecretaria.size() > MAX_AMBITOS) {
            porSecretaria.entrySet().removeIf(entrada -> entrada.getValue().version() < version);
            while (porSecretaria.size() > MAX_AMBITOS) {
                String masViejo = null;
                long versionMasVieja = Long.MAX_VALUE;
                for (Map.Entry<String, SnapshotSecretaria> entrada : porSecretaria.entrySet()) {
                    if (entrada.getValue().version() < versionMasVieja) {
                        versionMasVieja = entrada.getValue().version();
                        masViejo = entrada.getKey();
                    }
                }
                if (masViejo == null) {
                    break;
                }
                porSecretaria.remove(masViejo);
            }
        }
        porSecretaria.put(clave, snapshot);
    }

    private static byte[] comprimir(byte[] body) {
        ByteArrayOutputStream salida = new ByteArrayOutputStream(Math.max(1024, body.length / 10));
        try (GZIPOutputStream gzip = new GZIPOutputStream(salida, 16 * 1024)) {
            gzip.write(body);
        } catch (IOException e) {
            throw new UncheckedIOException(e);
        }
        return salida.toByteArray();
    }

    private static String etag(byte[] body) {
        try {
            byte[] hash = MessageDigest.getInstance("SHA-256").digest(body);
            StringBuilder sb = new StringBuilder(16);
            for (int i = 0; i < 8; i++) {
                sb.append(String.format("%02x", hash[i]));
            }
            return "\"" + sb + "\"";
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException(e);
        }
    }
}
