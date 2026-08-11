-- ============================================================================
--  ETAPA 2 · Numerador de pallets
--  Correr DESPUÉS de 001_schema.sql
-- ============================================================================

-- ----------------------------------------------------------------------------
--  Por qué una SEQUENCE y no "contar los pallets + 1":
--
--  Si dos tablets tocan "Crear e imprimir" en el mismo segundo, un COUNT(*)
--  les devuelve el mismo número a las dos y una de las dos explota (o peor:
--  quedan dos pallets con el mismo número).
--
--  nextval() sobre una sequence es atómico: Postgres garantiza que nunca
--  entrega el mismo valor dos veces, ni con 50 tablets a la vez.
--
--  Efecto secundario a tener en cuenta: si una operación falla después de
--  pedir el número, ese número se pierde (queda un salto en la numeración).
--  Es el comportamiento correcto — nunca se reusa un número.
-- ----------------------------------------------------------------------------

create sequence if not exists secuencia_pallet
  start with 1
  increment by 1
  no cycle;

-- Devuelve el próximo número ya formateado: "P-000458"
create or replace function siguiente_numero_pallet()
returns text
language sql
volatile
as $$
  select 'P-' || lpad(nextval('secuencia_pallet')::text, 6, '0');
$$;


-- ----------------------------------------------------------------------------
--  Si algún día arrancan desde un número que no sea el 1 (por ejemplo porque
--  venían numerando a mano hasta el 457), correr esto UNA VEZ:
--
--      select setval('secuencia_pallet', 457);
--
--  El siguiente pallet va a salir P-000458.
-- ----------------------------------------------------------------------------
