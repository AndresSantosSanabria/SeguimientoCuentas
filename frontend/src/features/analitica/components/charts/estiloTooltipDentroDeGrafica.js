/**
 * recharts voltea el tooltip al otro lado solo cuando la caja cabe dentro del area de
 * trazado (el viewBox). Si la caja es mas ancha que esa area, el volteo no alcanza:
 * la caja queda anclada al borde izquierdo del area y se sale de la tarjeta, lo que
 * abre scroll horizontal en toda la pagina.
 *
 * Este tope deja la caja a lo sumo del ancho del area de trazado, asi que el volteo de
 * recharts siempre encuentra espacio a un lado o al otro y el tooltip respeta el ancho
 * disponible en cualquier tamano de pantalla.
 *
 * `100%` es el ancho del contenedor de la grafica; se le descuenta lo que ocupan el
 * eje de categorias y los margenes, que es lo que no pertenece al area de trazado.
 */
export function estiloTooltipDentroDeGrafica({ anchoEje = 0, margenIzquierda = 0, margenDerecha = 0 } = {}) {
    const ocupado = anchoEje + margenIzquierda + margenDerecha;
    // El piso evita que en pantallas muy angostas la caja se reduzca a ilegible; aun
    // con el piso se mantiene dentro de la tarjeta, que tiene el relleno extra.
    return { maxWidth: `max(10rem, calc(100% - ${ocupado}px))` };
}
