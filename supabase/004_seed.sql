-- ============================================================================
--  ETAPA 2 · Datos de prueba
--  Correr AL FINAL, después de 003_rls.sql
--
--  Sirve para poder probar las pantallas sin cargar todo a mano.
--  Estos datos se pueden borrar o editar después desde Configuración.
-- ============================================================================

-- ----------------------------------------------------------------------------
--  Clientes
-- ----------------------------------------------------------------------------

insert into clientes (nombre) values
  ('FLOWI'),
  ('DISTRIBUIDORA SUR')
on conflict do nothing;

-- ----------------------------------------------------------------------------
--  Operarios (las iniciales son las que salen impresas en la etiqueta)
-- ----------------------------------------------------------------------------

insert into operarios (nombre, iniciales) values
  ('Tomás Dotti',   'TD'),
  ('Martín Álvarez', 'MA')
on conflict do nothing;

-- ----------------------------------------------------------------------------
--  Máquinas
-- ----------------------------------------------------------------------------

insert into maquinas (nombre) values
  ('Rollera 6'),
  ('Rollera 8')
on conflict do nothing;

-- ----------------------------------------------------------------------------
--  Medidas frecuentes por cliente → los chips de autocompletado de la
--  pantalla "Nuevo pallet"
-- ----------------------------------------------------------------------------

insert into plantillas_cliente (cliente_id, medida)
select c.id, m.medida
  from clientes c
  cross join (values ('45x60'), ('50x70'), ('60x90')) as m(medida)
 where lower(c.nombre) = 'flowi'
on conflict (cliente_id, medida) do nothing;

insert into plantillas_cliente (cliente_id, medida)
select c.id, m.medida
  from clientes c
  cross join (values ('60x90'), ('80x110')) as m(medida)
 where lower(c.nombre) = 'distribuidora sur'
on conflict (cliente_id, medida) do nothing;

-- ----------------------------------------------------------------------------
--  Verificación: si todo salió bien, esto tiene que devolver
--  2 clientes, 2 operarios, 2 máquinas y 5 plantillas.
-- ----------------------------------------------------------------------------

select 'clientes'   as tabla, count(*) from clientes
union all select 'operarios',  count(*) from operarios
union all select 'maquinas',   count(*) from maquinas
union all select 'plantillas', count(*) from plantillas_cliente
union all select 'config',     count(*) from configuracion;
