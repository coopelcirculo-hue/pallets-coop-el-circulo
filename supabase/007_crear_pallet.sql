-- ============================================================================
--  ETAPA 4 · Crear un pallet completo en una sola operación
--  Correr DESPUÉS de 006_login.sql
--
--  El problema que resuelve:
--  Guardar el pallet y guardar sus productos son dos operaciones distintas.
--  Si la tablet se corta, se queda sin señal o el operario cierra la pestaña
--  justo en el medio, quedaría un pallet numerado y VACÍO, sin contenido.
--
--  Una función de Postgres corre entera adentro de una transacción: o se
--  guarda todo, o no se guarda nada. No hay pallets a medio hacer.
--
--  Es seguro correrlo más de una vez.
-- ============================================================================

create or replace function crear_pallet(
  p_cliente_id           uuid,
  p_operario_id          uuid,
  p_maquina_id           uuid,
  p_turno                text,
  p_observaciones        text,
  p_formato_etiqueta_id  uuid,
  -- [{"medida":"45x60","micrones":40,"kilos":120}, ...]
  p_productos            jsonb
)
returns pallets
language plpgsql
-- SECURITY INVOKER (el valor por defecto): la función corre con los permisos
-- de quien la llama, así que la RLS se sigue aplicando. Sin sesión no entra.
security invoker
as $$
declare
  v_pallet   pallets;
  v_producto jsonb;
  v_orden    integer := 0;
  v_kilos    numeric;
begin
  if p_productos is null or jsonb_array_length(p_productos) = 0 then
    raise exception 'El pallet tiene que tener al menos un producto cargado.';
  end if;

  -- El número lo da la sequence: atómico, sin riesgo de que dos tablets
  -- saquen el mismo (ver 002_secuencia.sql).
  insert into pallets (
    numero_pallet, cliente_id, operario_id, maquina_id,
    turno, observaciones, formato_etiqueta_id
  )
  values (
    siguiente_numero_pallet(),
    p_cliente_id,
    p_operario_id,
    p_maquina_id,
    p_turno,
    nullif(btrim(coalesce(p_observaciones, '')), ''),
    p_formato_etiqueta_id
  )
  returning * into v_pallet;

  for v_producto in select * from jsonb_array_elements(p_productos)
  loop
    v_orden := v_orden + 1;

    v_kilos := nullif(btrim(coalesce(v_producto ->> 'kilos', '')), '')::numeric;

    if v_kilos is null or v_kilos <= 0 then
      raise exception 'La fila % no tiene kilos válidos.', v_orden;
    end if;

    insert into productos_pallet (pallet_id, medida, micrones, kilos, orden)
    values (
      v_pallet.id,
      btrim(v_producto ->> 'medida'),
      nullif(btrim(coalesce(v_producto ->> 'micrones', '')), '')::numeric,
      v_kilos,
      v_orden
    );
  end loop;

  -- El trigger de productos_pallet ya recalculó peso_total, pero v_pallet es
  -- una copia de antes de eso: hay que releer la fila para devolverla al día.
  select * into v_pallet from pallets where id = v_pallet.id;

  return v_pallet;
end;
$$;

-- ----------------------------------------------------------------------------
--  Permisos: solo usuarios logueados. Postgres deja ejecutar funciones a todo
--  el mundo por defecto, así que hay que sacárselo explícitamente a anon.
-- ----------------------------------------------------------------------------

revoke execute on function crear_pallet(uuid, uuid, uuid, text, text, uuid, jsonb)
  from public, anon;

grant execute on function crear_pallet(uuid, uuid, uuid, text, text, uuid, jsonb)
  to authenticated;
