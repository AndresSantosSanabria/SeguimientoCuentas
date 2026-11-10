package com.sgcc.seguimientocuentas.contratos.application;

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
import java.util.concurrent.atomic.AtomicReference;
import java.util.concurrent.locks.ReentrantLock;
import java.util.zip.GZIPOutputStream;

/**
 * Serializa el indice en memoria y conserva el resultado mientras la version del indice no se mueva.
 * No consulta la base: el TTL desaparecio, y una rafaga de eventos CDC produce una sola serializacion
 * porque la publicacion se coalesce en una ventana configurable que se estira si serializar tarda.
 * El gzip tambien se hace aqui, una vez por publicacion, para que nginx no comprima 30 MB por usuario.
 */
@Service
public class ContratoResumenCache {

    public record Snapshot(byte[] body, byte[] bodyGzip, String etag, long generadoEn, long version) {}

    private static final Logger log = LoggerFactory.getLogger(ContratoResumenCache.class);

    private final ContratoResumenIndex indice;
    private final ObjectMapper objectMapper;
    private final long ventanaPublicacionMillis;

    private final AtomicReference<Snapshot> actual = new AtomicReference<>();
    private final ReentrantLock lock = new ReentrantLock();
    private volatile long proximaPublicacionPermitida;

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
        actual.set(new Snapshot(body, bodyGzip, etag(body), System.currentTimeMillis(), publicacion.version()));
        log.info("Resumen publicado: {} contratos, {} KB ({} KB gzip), {} ms, version {}",
                publicacion.contratos().size(), body.length / 1024, bodyGzip.length / 1024, duracion,
                publicacion.version());
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
