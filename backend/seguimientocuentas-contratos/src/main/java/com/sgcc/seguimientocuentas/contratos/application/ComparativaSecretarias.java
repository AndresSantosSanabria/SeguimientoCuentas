package com.sgcc.seguimientocuentas.contratos.application;

import com.sgcc.seguimientocuentas.common.dto.ComparativaSecretariaDTO;
import com.sgcc.seguimientocuentas.common.dto.ContratoResumenDTO;
import com.sgcc.seguimientocuentas.common.dto.CuentaDetalleDTO;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;

/**
 * Compara secretarias por su proceso de cobro. Los datos salen del indice en memoria: no se
 * consulta la base y solo se devuelven agregados por secretaria, nunca el detalle de un contrato.
 *
 * El recorte es el mismo que aplica la pagina de analitica: el rango de fechas o los anios
 * elegidos sobre la vigencia del contrato y el alcance de cuentas (en curso, cerradas o ambas).
 * Las cuentas exigibles son las cuotas vencidas dentro de ese rango, igual que en la grafica
 * «Cuentas por secretaria».
 */
public class ComparativaSecretarias {

    private static final int ESTADO_APROBADO = 19;
    private static final int LIMITE_CUOTAS = 2400;
    private static final LocalDate SIN_INICIO = LocalDate.of(1900, 1, 1);

    private final List<ComparativaSecretariaDTO> secretarias;

    public ComparativaSecretarias(List<ComparativaSecretariaDTO> secretarias) {
        this.secretarias = secretarias;
    }

    public List<ComparativaSecretariaDTO> secretarias() {
        return secretarias;
    }

    /**
     * Agrega los contratos por secretaria. Devuelve todas las secretarias con contratos, de
     * modo que el usuario pueda elegir cualquiera en la comparativa.
     */
    public static ComparativaSecretarias construir(List<ContratoResumenDTO> contratos,
                                                    List<Integer> anios, LocalDate desde, LocalDate hasta,
                                                    String alcance, LocalDate hoy) {
        Map<String, Acumulado> porSecretaria = new LinkedHashMap<>();
        // El rango de fechas recorta la cuota, no el contrato: un extremo vacio se abre al
        // principio del historico o a hoy, igual que en la pagina de analitica.
        boolean conRango = desde != null || hasta != null;
        LocalDate rangoDesde = conRango ? (desde != null ? desde : SIN_INICIO) : null;
        LocalDate rangoHasta = conRango ? (hasta != null ? hasta : hoy) : null;
        // El corte son las cuotas ya vencidas: con rango, el tope del rango; sin rango, el fin
        // del anio medido (o hoy, si el anio sigue abierto).
        LocalDate corte = conRango
                ? (rangoHasta.isAfter(hoy) ? hoy : rangoHasta)
                : corteSinRango(anios, hoy);

        for (ContratoResumenDTO contrato : contratos) {
            if (!enPeriodo(contrato, anios, desde, hasta)) {
                continue;
            }
            List<CuentaDetalleDTO> cuentas = cuentasDelAlcance(contrato, alcance);
            if (cuentas == null) {
                continue;
            }
            LocalDate inicio = fecha(contrato.getFechaInicio());
            LocalDate fin = fecha(contrato.getFechaFin());
            // Sin vigencia completa el contrato no se puede medir: la grafica «Cuentas por
            // secretaria» tambien lo descarta, y las dos vistas deben decir lo mismo.
            if (inicio == null || fin == null || fin.isBefore(inicio)) {
                continue;
            }
            List<Cuota> calendario = cuotas(inicio, fin, corte);
            if (calendario.isEmpty()) {
                continue;
            }
            List<Cuota> visibles = conRango ? solapan(calendario, rangoDesde, rangoHasta) : calendario;

            int completadas = completadas(cuentas, calendario, visibles, contrato, alcance);
            int moraDelContrato = Math.max(0, visibles.size() - completadas);

            String etiqueta = etiquetaSecretaria(contrato);
            Acumulado acumulado = porSecretaria.computeIfAbsent(etiqueta, Acumulado::new);
            acumulado.contratos++;
            acumulado.radicadas += cuentas.size();
            acumulado.exigibles += visibles.size();
            acumulado.completadas += completadas;
            acumulado.enMora += moraDelContrato;
            if (moraDelContrato > 0) {
                acumulado.contratosConMora++;
            }
            if (contrato.getValorTotal() != null) {
                acumulado.valorTotal = acumulado.valorTotal.add(contrato.getValorTotal());
            }
        }
        List<ComparativaSecretariaDTO> lista = new ArrayList<>(porSecretaria.size());
        for (Acumulado acumulado : porSecretaria.values()) {
            ComparativaSecretariaDTO dto = new ComparativaSecretariaDTO();
            dto.setSecretaria(acumulado.nombre);
            dto.setContratos(acumulado.contratos);
            dto.setRadicadas(acumulado.radicadas);
            dto.setExigibles(acumulado.exigibles);
            dto.setCompletadas(acumulado.completadas);
            dto.setPendientes(Math.max(0, acumulado.exigibles - acumulado.completadas));
            dto.setEnMora(acumulado.enMora);
            dto.setContratosConMora(acumulado.contratosConMora);
            dto.setCobertura(acumulado.exigibles > 0
                    ? acumulado.completadas * 100.0 / acumulado.exigibles
                    : 0.0);
            dto.setValorTotal(acumulado.valorTotal);
            lista.add(dto);
        }
        lista.sort(Comparator.comparingInt(ComparativaSecretariaDTO::getContratos).reversed()
                .thenComparing(ComparativaSecretariaDTO::getSecretaria));
        return new ComparativaSecretarias(lista);
    }

    /** Sin rango de fechas, el corte es el fin del anio medido, tope hoy. */
    private static LocalDate corteSinRango(List<Integer> anios, LocalDate hoy) {
        int anio = anios != null && !anios.isEmpty()
                ? anios.stream().filter(java.util.Objects::nonNull).mapToInt(Integer::intValue).max().orElse(hoy.getYear())
                : hoy.getYear();
        LocalDate finAnio = LocalDate.of(anio, 12, 31);
        return finAnio.isAfter(hoy) ? hoy : finAnio;
    }

    /** Las cuotas del contrato que ya vencieron al corte. */
    private static List<Cuota> cuotas(LocalDate inicio, LocalDate fin, LocalDate corte) {
        List<Cuota> cuotas = new ArrayList<>();
        int meses = Math.min(mesesEntre(inicio, fin), LIMITE_CUOTAS);
        for (int k = 0; k < meses; k++) {
            LocalDate desde = inicio.plusMonths(k);
            LocalDate cierre = inicio.plusMonths(k + 1L).minusDays(1);
            LocalDate limite = cierre.isAfter(fin) ? fin : cierre;
            if (limite.isAfter(corte)) {
                break;
            }
            cuotas.add(new Cuota(k, desde, limite));
        }
        return cuotas;
    }

    /** Las cuotas que se solapan con el rango de fechas. */
    private static List<Cuota> solapan(List<Cuota> calendario, LocalDate desde, LocalDate hasta) {
        List<Cuota> visibles = new ArrayList<>();
        for (Cuota cuota : calendario) {
            if (cuota.desde.isAfter(hasta)) {
                continue;
            }
            if (cuota.hasta.isBefore(desde)) {
                continue;
            }
            visibles.add(cuota);
        }
        return visibles;
    }

    /**
     * Cuantas cuotas visibles quedaron cubiertas por una cuenta radicada. Cada cuenta cubre una
     * cuota: la primera que se solapa con su propio periodo, en orden. El emparejamiento se hace
     * sobre el calendario completo y luego se cuentan las cuotas visibles covered, igual que
     * en la grafica de la pagina.
     */
    private static int completadas(List<CuentaDetalleDTO> cuentas, List<Cuota> calendario,
                                   List<Cuota> visibles, ContratoResumenDTO contrato, String alcance) {
        if (cuentas.isEmpty()) {
            // Sin detalle real vale el conteo declarado: las primeras cuentas del calendario.
            int declaradas = "ambas".equals(alcance)
                    ? contrato.getCuentasRegistradas()
                    : 0;
            int cubiertas = Math.min(Math.max(0, declaradas), calendario.size());
            int completadas = 0;
            for (Cuota cuota : visibles) {
                if (cuota.indice < cubiertas) {
                    completadas++;
                }
            }
            return completadas;
        }
        List<CuentaDetalleDTO> ordenadas = new ArrayList<>(cuentas);
        ordenadas.sort(Comparator
                .comparing((CuentaDetalleDTO cuenta) -> String.valueOf(cuenta.getFechaInicio()))
                .thenComparingLong(CuentaDetalleDTO::getIdInformeActividad));
        boolean[] usadas = new boolean[calendario.size()];
        int[] puntero = {0};
        for (CuentaDetalleDTO cuenta : ordenadas) {
            LocalDate desde = fecha(cuenta.getFechaInicio());
            LocalDate hasta = fecha(cuenta.getFechaFin());
            if (desde == null) {
                continue;
            }
            if (hasta == null || hasta.isBefore(desde)) {
                hasta = desde;
            }
            for (int i = puntero[0]; i < calendario.size(); i++) {
                Cuota cuota = calendario.get(i);
                if (cuota.hasta.isBefore(desde)) {
                    continue;
                }
                if (cuota.desde.isAfter(hasta)) {
                    break;
                }
                if (usadas[i]) {
                    continue;
                }
                usadas[i] = true;
                puntero[0] = i;
                break;
            }
        }
        int completadas = 0;
        for (Cuota cuota : visibles) {
            if (usadas[cuota.indice]) {
                completadas++;
            }
        }
        return completadas;
    }

    /**
     * Las cuentas que entran en el alcance pedido, o null si el contrato no cuenta para ese
     * alcance. En «cerradas» solo los que tienen alguna cuenta cerrada; en «en curso» los que
     * tienen alguna abierta, mas los que todavia no radicaron ninguna cuenta.
     */
    private static List<CuentaDetalleDTO> cuentasDelAlcance(ContratoResumenDTO contrato, String alcance) {
        List<CuentaDetalleDTO> todas = contrato.getCuentasDetalle();
        if (todas == null) {
            todas = List.of();
        }
        if ("ambas".equals(alcance)) {
            return todas;
        }
        boolean cerradas = "cerradas".equals(alcance);
        List<CuentaDetalleDTO> enAlcance = new ArrayList<>();
        for (CuentaDetalleDTO cuenta : todas) {
            boolean cerrada = cuenta.getIdEstadoActual() == ESTADO_APROBADO;
            if (cerradas == cerrada) {
                enAlcance.add(cuenta);
            }
        }
        if (enAlcance.isEmpty()) {
            // Sin cuentas del alcance: en «cerradas» no hay nada cerrado que contar; en
            // «en curso» solo sobreviven los contratos que aun no radicaron ninguna cuenta.
            if (cerradas || !todas.isEmpty()) {
                return null;
            }
        }
        return enAlcance;
    }

    /** El contrato cae en el periodo pedido: por anios de vigencia y por rango de fechas. */
    private static boolean enPeriodo(ContratoResumenDTO contrato, List<Integer> anios,
                                     LocalDate desde, LocalDate hasta) {
        LocalDate inicio = fecha(contrato.getFechaInicio());
        if (inicio == null) {
            return false;
        }
        LocalDate fin = fecha(contrato.getFechaFin());
        LocalDate hastaVigencia = fin == null || fin.isBefore(inicio) ? inicio : fin;
        if (anios != null && !anios.isEmpty()) {
            boolean alguno = false;
            for (Integer anio : anios) {
                if (anio != null && anio >= inicio.getYear() && anio <= hastaVigencia.getYear()) {
                    alguno = true;
                    break;
                }
            }
            if (!alguno) {
                return false;
            }
        }
        if (desde != null && hastaVigencia.isBefore(desde)) {
            return false;
        }
        return hasta == null || !inicio.isAfter(hasta);
    }

    /**
     * Meses de vigencia del contrato: los mismos que cuenta la grafica «Cuentas por secretaria».
     * El dia extra se cuenta solo si la vigencia no cae en un dia exacto de mes.
     */
    private static int mesesEntre(LocalDate inicio, LocalDate fin) {
        int anios = fin.getYear() - inicio.getYear();
        int meses = fin.getMonthValue() - inicio.getMonthValue();
        int dias = fin.getDayOfMonth() - inicio.getDayOfMonth();
        if (dias < 0) {
            int diasMesAnterior = fin.minusMonths(1).lengthOfMonth();
            dias += diasMesAnterior;
            meses -= 1;
        }
        if (meses < 0) {
            anios -= 1;
            meses += 12;
        }
        return Math.max(1, anios * 12 + meses + (dias > 0 ? 1 : 0));
    }

    private static LocalDate fecha(String valor) {
        if (valor == null || valor.isBlank()) {
            return null;
        }
        String limpio = valor.trim();
        try {
            LocalDate fecha = LocalDate.parse(limpio.substring(0, Math.min(10, limpio.length())));
            return fecha.getYear() >= 1900 && fecha.getYear() <= 2100 ? fecha : null;
        } catch (RuntimeException e) {
            return null;
        }
    }

    /** La dependencia registrada; si falta, el prefijo del numero de contrato. */
    static String etiquetaSecretaria(ContratoResumenDTO contrato) {
        String registrada = contrato.getDependencia();
        if (registrada != null && !registrada.trim().isEmpty()) {
            return registrada.trim();
        }
        String numero = contrato.getNoContrato();
        if (numero != null) {
            String prefijo = numero.split("-")[0].trim().toUpperCase(Locale.ROOT);
            if (!prefijo.isEmpty()) {
                return prefijo;
            }
        }
        return "Sin dependencia";
    }

    private record Cuota(int indice, LocalDate desde, LocalDate hasta) {}

    private static final class Acumulado {
        private final String nombre;
        private int contratos;
        private long radicadas;
        private long exigibles;
        private long completadas;
        private long enMora;
        private long contratosConMora;
        private BigDecimal valorTotal = BigDecimal.ZERO;

        private Acumulado(String nombre) {
            this.nombre = nombre;
        }
    }
}
