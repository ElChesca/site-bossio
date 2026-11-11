# Integración del sitio Bossio con Baboons

## Resumen

El sitio corresponde al negocio Casa Central Bossio, `negocio_id = 20`. El navegador no se conecta a la base de datos: consulta los endpoints públicos de Baboons. En producción, Vercel reenvía `/api/*` al backend configurado en `vercel.json`, por lo que las llamadas del navegador permanecen en el mismo origen y no requieren un token ERP en el frontend.

El código cliente actual está en `site.js`; la configuración de rutas y proxy está en `vercel.json`. Las rutas del backend se implementan en `app/routes/sales_portal_routes.py` de MultinegocioBaboons.

## Endpoints usados

| Operación | Método y ruta | Uso |
|---|---|---|
| Consultar catálogo | `GET /api/public/negocios/20/productos` | Carga productos y categorías visibles en la web |
| Enviar pedido | `POST /api/public/negocios/20/pedidos` | Registra el pedido, sus detalles y la actividad asociada en CRM |
| Solicitar presupuesto | `POST /api/public/negocios/20/presupuestos-web` | Registra una consulta comercial en CRM; no emite un presupuesto formal |

Los tres endpoints son públicos y no requieren `Authorization`. No se deben agregar credenciales internas al JavaScript del navegador.

## 1. Consultar productos

```http
GET /api/public/negocios/20/productos
Accept: application/json
```

Respuesta `200`:

```json
{
  "productos": [
    {
      "id": 123,
      "nombre": "Producto de ejemplo",
      "precio_original": 1500.0,
      "precio_final": 1500.0,
      "precio_venta": 1500.0,
      "imagen_url": null,
      "sku": "SKU-123",
      "stock": 8.0,
      "stock_comprometido": 0.0,
      "destacado": false,
      "categoria_id": 4,
      "categoria_nombre": "Panadería",
      "tipo_vehiculo": "",
      "medida": "",
      "marca": "",
      "modelo": ""
    }
  ],
  "categorias": [
    { "id": 4, "nombre": "Panadería" }
  ]
}
```

El ERP devuelve únicamente productos activos y con `visible_web = true` del negocio indicado. Para precios personalizados se admite `?cliente_id=<id>`; el sitio público actual no envía ese parámetro y usa el precio público. El frontend usa `id`, `nombre`, `sku`, `imagen_url`, `stock`, `categoria_id`, `categoria_nombre` y `precio_venta`.

## 2. Enviar un pedido

```http
POST /api/public/negocios/20/pedidos
Content-Type: application/json
Accept: application/json
```

Cuerpo enviado por el sitio:

```json
{
  "nombre": "Ana Pérez",
  "telefono": "+54 9 266 400-0000",
  "direccion": "San Luis 123",
  "observaciones": "Entregar por la tarde",
  "detalles": [
    { "producto_id": 123, "cantidad": 2 }
  ]
}
```

`nombre` y `telefono` son obligatorios para pedidos B2C. `direccion` y `observaciones` son opcionales. `detalles` debe contener al menos un artículo con `producto_id` y `cantidad`. El endpoint también admite `cliente_id` para clientes B2B, pero el sitio público actual no lo envía.

El ERP vuelve a comprobar que cada producto pertenezca al negocio, esté activo y sea visible en la web. Calcula los precios y el total en el servidor; cualquier total mostrado antes de enviar es solo estimativo. El pedido se crea en estado `pendiente`, se guardan sus detalles y se registra la actividad correspondiente en CRM.

Respuesta `201`:

```json
{
  "message": "¡Pedido recibido con éxito!",
  "pedido_id": 456,
  "numero_interno": 789,
  "total": 3000.0
}
```

El sitio muestra `numero_interno` como referencia del pedido.

## 3. Solicitar un presupuesto

```http
POST /api/public/negocios/20/presupuestos-web
Content-Type: application/json
Accept: application/json
```

Cuerpo enviado por el formulario:

```json
{
  "nombre": "Ana Pérez",
  "telefono": "+54 9 266 400-0000",
  "email": "ana@example.com",
  "tipo": "catering",
  "fecha_evento": "2026-12-20",
  "personas": "40",
  "detalle": "Coffee para un evento familiar",
  "website": ""
}
```

`nombre`, `telefono` y `detalle` son obligatorios. `email`, `tipo`, `fecha_evento` y `personas` son opcionales. Límites del endpoint: nombre 120 caracteres, teléfono 40, email 254, tipo 40, fecha 20, personas 20 y detalle 1500. El correo se valida si se envía.

Una respuesta `201` con `{"message":"Solicitud recibida"}` significa que la consulta quedó registrada como actividad `consulta_web` en el CRM. El lead se busca por teléfono dentro del negocio 20; si no existe, se crea con origen `web_bossio`.

`website` es un campo trampa antispam y debe quedar vacío. Si se completa, el backend responde `202` sin guardar la consulta.

## Errores y reintentos

Los errores usan JSON con la forma `{"error":"..."}`. Según la operación, pueden responder `400` por datos incompletos, `404` por negocio o producto no disponible y `500` por un error del servidor. En éxito, pedidos y consultas responden `201`; el filtro antispam de presupuestos responde `202`.

El endpoint de pedidos no usa una clave de idempotencia. Si la conexión se corta después del envío y no llega la respuesta, no reenvíes automáticamente: primero verificá en Baboons si el pedido quedó registrado, para evitar duplicados.

## Enrutamiento de producción

`vercel.json` contiene el proxy de `/api/:path*` hacia Baboons y los rewrites de `/bossio/*` para servir la página y sus recursos estáticos. Para probar esta integración en producción, esos cambios tienen que estar incluidos en el despliegue activo de Vercel. Si cambia el dominio del ERP, hay que actualizar el destino del rewrite de API.
