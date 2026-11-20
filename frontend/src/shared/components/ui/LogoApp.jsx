/**
 * Logo institucional del aplicativo. Se usa en la barra superior, en las
 * pantallas de carga y en el arranque del documento (index.html), de modo
 * que la marca este siempre visible en el mismo lugar.
 *
 * El archivo canonicamente vive en `frontend/public/img/logo.png` (carpeta
 * publica de Vite): los estaticos referenciados por index.html —favicon y
 * pantalla de arranque— necesitan una URL estable, que solo da `public/`.
 * Esta componente es el unico punto del codigo React que conoce la ruta.
 */
export function LogoApp({ alt = 'GE-COR', className = 'logo-app' }) {
  return <img src="/img/logo.png" alt={alt} className={className} />;
}
