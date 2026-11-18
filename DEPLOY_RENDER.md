# Guía de publicación en Render (ejemplo)

1. Crea una cuenta en Render y un repositorio Git privado con estos archivos.
2. Crea un servicio PostgreSQL gestionado y copia su URL interna.
3. Crea un Web Service desde el repositorio, con runtime Node.
4. Build command: `npm install`
5. Start command: `npm start`
6. En Environment Variables configura:
   - `DATABASE_URL`: URL de la base PostgreSQL de Render
   - `JWT_SECRET`: valor aleatorio largo (32+ caracteres)
   - `COOKIE_SECURE`: `true`
   - `ADMIN_USERNAME`: tu nombre de administrador
   - `ADMIN_PASSWORD`: contraseña de admin fuerte de 14+ caracteres
   - `NODE_ENV`: `production`
7. Ejecuta `db/schema.sql` contra la base PostgreSQL una sola vez desde una herramienta SQL.
8. Deploy y prueba registro/login, saldo virtual, boletos demo y el panel admin.

**No compartas claves de la base de datos, tokens ni contraseña de admin en chats o repositorios públicos.** Este starter no ha sido desplegado a un dominio público; necesitas crear y configurar cuentas en el proveedor de hosting y DB. Recomendable una revisión profesional de seguridad antes de publicarlo.
