-- ============================================================================
--  ETAPA 7 · El dpi pasa a ser de la impresora, no de cada etiqueta
--  Correr DESPUÉS de 007_crear_pallet.sql
--
--  Por qué se mueve:
--  El dpi son los puntos por pulgada del cabezal térmico. Es una característica
--  física de la impresora (el ZD421 se fabrica en 203 o en 300), no de la
--  etiqueta. Tenerlo en cada formato obligaba a repetir el mismo número en
--  todos, y con equivocarse en uno esa etiqueta salía con el texto a otra
--  escala. Lo que sí cambia por etiqueta es el tamaño: eso se queda donde está.
--
--  Es seguro correrlo más de una vez.
-- ============================================================================

alter table configuracion
  add column if not exists impresora_dpi integer not null default 203;

-- Postgres no tiene "add constraint if not exists": se borra y se vuelve a crear.
alter table configuracion drop constraint if exists impresora_dpi_valido;
alter table configuracion
  add constraint impresora_dpi_valido check (impresora_dpi in (203, 300));

-- ----------------------------------------------------------------------------
--  Se rescata el valor que hubiera cargado en el formato predeterminado antes
--  de borrar la columna, para no perder la configuración que ya estaba puesta.
-- ----------------------------------------------------------------------------

do $$
begin
  if exists (
    select 1 from information_schema.columns
     where table_schema = 'public'
       and table_name = 'formatos_etiqueta'
       and column_name = 'dpi'
  ) then
    update configuracion
       set impresora_dpi = coalesce(
             (select dpi from formatos_etiqueta where predeterminado limit 1),
             impresora_dpi)
     where id = 1;

    alter table formatos_etiqueta drop column dpi;
  end if;
end $$;

-- El check del dpi ya no tiene sentido en los formatos.
alter table formatos_etiqueta drop constraint if exists formato_dpi_valido;

select impresora_dpi, marca_principal from configuracion where id = 1;
