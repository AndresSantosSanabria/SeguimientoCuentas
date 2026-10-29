package com.sgcc.seguimientocuentas.contratos.application;

import tools.jackson.databind.ObjectMapper;
import com.sgcc.seguimientocuentas.common.dto.ContratoResumenDTO;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.List;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.concurrent.atomic.AtomicReference;
import java.util.concurrent.locks.ReentrantLock;

/**
 * Una sola ejecución de las consultas batch sirve a todos los usuarios: se reconstruye cuando un evento
 * CDC marca un cambio o cuando vence el TTL de seguridad.
 */
@Service
public class ContratoResumenCache {

    public record Snapshot(byte[] body, String etag, long generadoEn, int marcaInvalidacion) {}

    private static final Logger log = LoggerFactory.getLogger(ContratoResumenCache.class);

    private final ContratoApplicationService contratoApplicationService;
    private final ObjectMapper objectMapper;
    private final long ttlMillis;

    private final AtomicReference<Snapshot> actual = new AtomicReference<>();
    private final AtomicInteger invalidaciones = new AtomicInteger();
    private final ReentrantLock lock = new ReentrantLock();

    public ContratoResumenCache(ContratoApplicationService contratoApplicationService,
                                ObjectMapper objectMapper,
                                @Value("${contratos.resumen.ttl-ms:120000}") long ttlMillis) {
        this.contratoApplicationService = contratoApplicationService;
        this.objectMapper = objectMapper;
        this.ttlMillis = ttlMillis;
    }

    public Snapshot obtener() {
        Snapshot previa = actual.get();
        if (previa != null && estaVigente(previa)) {
            return previa;
        }
        if (previa == null) {
            lock.lock();
        } else if (!lock.tryLock()) {
            return previa;
        }
        try {
            Snapshot s = actual.get();
            return s != null && estaVigente(s) ? s : reconstruir();
        } finally {
            lock.unlock();
        }
    }

    public void invalidar() {
        invalidaciones.incrementAndGet();
    }

    private Snapshot reconstruir() {
        long inicio = System.currentTimeMillis();
        int marca = invalidaciones.get();
        List<ContratoResumenDTO> contratos = contratoApplicationService.listarContratosResumen();
        byte[] body = objectMapper.writeValueAsBytes(contratos);
        Snapshot nuevo = new Snapshot(body, etag(body), System.currentTimeMillis(), marca);
        actual.set(nuevo);
        log.info("Resumen reconstruido: {} contratos, {} KB, {} ms",
                contratos.size(), body.length / 1024, System.currentTimeMillis() - inicio);
        return nuevo;
    }

    private boolean estaVigente(Snapshot s) {
        return s.marcaInvalidacion() == invalidaciones.get()
                && System.currentTimeMillis() - s.generadoEn() < ttlMillis;
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
