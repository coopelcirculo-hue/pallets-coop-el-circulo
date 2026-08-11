-- ============================================================================
--  ETAPA 2 · Row Level Security
--  Correr DESPUÉS de 002_secuencia.sql
-- ============================================================================
--
--  IMPORTANTE — leer antes de correr:
--
--  Como el sitio es estático (GitHub Pages), no hay servidor que esconda una
--  clave secreta: la única clave que existe es la anónima, y esa la puede ver
--  cualquiera que abra el código fuente de la página. Por lo tanto RLS es LO
--  ÚNICO que protege los datos.
--
--  Estas políticas asumen que la app tiene LOGIN con Supabase Auth, igual que
--  el dashboard de máquinas que ya está andando. O sea:
--
--     - usuario logueado  → puede trabajar
--     - sin loguear       → no ve ni escribe absolutamente nada
--
--  Si al final se decide que no haya login, avisame y las reescribo, pero
--  entonces cualquiera con la URL podría leer y cargar pallets.
-- ============================================================================

alter table clientes           enable row level security;
alter table operarios          enable row level security;
alter table maquinas           enable row level security;
alter table pallets            enable row level security;
alter table productos_pallet   enable row level security;
alter table plantillas_cliente enable row level security;
alter table impresiones        enable row level security;
alter table configuracion      enable row level security;

-- ----------------------------------------------------------------------------
--  Tablas maestras y configuración: acceso completo para usuarios logueados
-- ----------------------------------------------------------------------------

drop policy if exists clientes_autenticado on clientes;
create policy clientes_autenticado on clientes
  for all to authenticated using (true) with check (true);

drop policy if exists operarios_autenticado on operarios;
create policy operarios_autenticado on operarios
  for all to authenticated using (true) with check (true);

drop policy if exists maquinas_autenticado on maquinas;
create policy maquinas_autenticado on maquinas
  for all to authenticated using (true) with check (true);

drop policy if exists plantillas_autenticado on plantillas_cliente;
create policy plantillas_autenticado on plantillas_cliente
  for all to authenticated using (true) with check (true);

drop policy if exists configuracion_autenticado on configuracion;
create policy configuracion_autenticado on configuracion
  for all to authenticated using (true) with check (true);

-- ----------------------------------------------------------------------------
--  Pallets: se pueden ver, crear y modificar. NO se pueden borrar.
--
--  No hay política de DELETE a propósito. Sin política, Postgres rechaza la
--  operación. Un pallet que se imprimió y se fue en un camión no se puede
--  hacer desaparecer del sistema: si está mal, se corrige, no se borra.
-- ----------------------------------------------------------------------------

drop policy if exists pallets_lectura on pallets;
create policy pallets_lectura on pallets
  for select to authenticated using (true);

drop policy if exists pallets_alta on pallets;
create policy pallets_alta on pallets
  for insert to authenticated with check (true);

drop policy if exists pallets_edicion on pallets;
create policy pallets_edicion on pallets
  for update to authenticated using (true) with check (true);

-- ----------------------------------------------------------------------------
--  Productos: acceso completo (se agregan y se sacan filas mientras se carga)
-- ----------------------------------------------------------------------------

drop policy if exists productos_autenticado on productos_pallet;
create policy productos_autenticado on productos_pallet
  for all to authenticated using (true) with check (true);

-- ----------------------------------------------------------------------------
--  Impresiones: es un registro de auditoría, no una tabla común.
--  Se puede leer y agregar. NO se puede editar ni borrar, ni siquiera desde
--  la app. Si se pudiera reescribir, no serviría como registro de nada.
-- ----------------------------------------------------------------------------

drop policy if exists impresiones_lectura on impresiones;
create policy impresiones_lectura on impresiones
  for select to authenticated using (true);

drop policy if exists impresiones_alta on impresiones;
create policy impresiones_alta on impresiones
  for insert to authenticated with check (true);

-- ----------------------------------------------------------------------------
--  Chequeo rápido: esta consulta lista las políticas que quedaron activas.
--
--      select tablename, policyname, cmd, roles
--        from pg_policies
--       where schemaname = 'public'
--       order by tablename, policyname;
-- ----------------------------------------------------------------------------
