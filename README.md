# FUTBET - Starter para plataforma web de demostración

**Esta aplicación es únicamente una demo de deportes con créditos virtuales. No incluye depósitos, pagos, retiros, apuestas con dinero real, ni integraciones con casas de apuestas.** Antes de cualquier operación real, se necesita asesoría legal y las licencias/autorizaciones aplicables.

## Incluye
- Sitio en español, adaptado a móvil.
- PostgreSQL central para cuentas, eventos y boletos demo.
- Registro/login con contraseñas hash y cookie de sesión HttpOnly.
- Créditos virtuales (saldo inicial de 1.000).
- Creación de boletos virtuales; el servidor revalida eventos y cuotas.
- Panel admin para publicar eventos, modificar cuotas y retirar eventos.

## Requisitos
Node.js 20+ y una base PostgreSQL (local o alojada).

## Ejecutar localmente
1. Instala Node 20+ y PostgreSQL.
2. Crea una base, por ejemplo `futbet`.
3. Ejecuta el SQL: `psql "$DATABASE_URL" -f db/schema.sql`.
4. Copia `.env.example` como `.env` y completa `DATABASE_URL`, `JWT_SECRET`, `ADMIN_USERNAME`, `ADMIN_PASSWORD`.
5. `npm install` y `npm start`.
6. Abre `http://localhost:3000`.

## Crear cuenta administradora
Antes de iniciar el servidor, configura `ADMIN_USERNAME` y `ADMIN_PASSWORD` en `.env`. En el primer arranque se crea o eleva esa cuenta a admin. Usa contraseña fuerte y no la compartas.


