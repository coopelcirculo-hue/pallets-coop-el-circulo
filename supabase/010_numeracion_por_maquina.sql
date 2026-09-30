-- ============================================================================
--  ETAPA 8b · Cada máquina lleva su propio conteo de bobinas
--  Correr DESPUÉS de 009_bobinas.sql
--
--  Antes la numeración era una sola para toda la planta (B-000001, B-000002…),
--  así que la bobina 12 podía ser de la máquina 6 y la 13 de la 10. En planta
--  no se piensa así: cada extrusora lleva su propia cuenta.
--
--  Ahora el número queda "06-00123": máquina 06, bobina 123 de ESA máquina.
--  Sigue siendo único en todo el sistema, así que una bobina se rastrea con un
--  solo dato, pero el conteo es por máquina como se pidió.
--
--  Es seguro correrlo más de una vez.
-- ============================================================================

-- ----------------------------------------------------------------------------
--  El contador vive en la máquina.
--
--  Por qué una columna y no una sequence por máquina: con UPDATE ... RETURNING
--  Postgres bloquea la fila mientras la incrementa, así que dos bobinas
--  cargadas en el mismo segundo en la misma máquina nunca sacan el mismo
--  número. Y agregar una máquina nueva no obliga a crear nada más.
-- ----------------------------------------------------------------------------

alter table maquinas
  add column if not exists contador_bobinas integer not null default 0;

alter table bobinas
  add column if not exists numero_en_maquina integer;

create index if not exists bobinas_numero_en_maquina_idx
  on bobinas (maquina_id, numero_en_maquina desc);

-- ----------------------------------------------------------------------------
--  Las bobinas que ya existían se numeran hacia atrás, por máquina y por orden
--  de carga, y cada contador queda donde corresponde para seguir desde ahí.
--  No se les cambia el numero_bobina viejo: si alguna ya se imprimió, la
--  etiqueta pegada tiene que seguir coincidiendo con el sistema.
-- ----------------------------------------------------------------------------

with numeradas as (
  select id,
         row_number() over (partition by maquina_id order by creado_en, id) as n
    from bobinas
   where numero_en_maquina is null
)
update bobinas b
   set numero_en_maquina = numeradas.n
  from numeradas
 where b.id = numeradas.id;

update maquinas m
   set contador_bobinas = greatest(
         m.contador_bobinas,
         coalesce((select max(b.numero_en_maquina) from bobinas b where b.maquina_id = m.id), 0));

-- ----------------------------------------------------------------------------
--  Crear una bobina, ahora con el contador de su máquina
-- ----------------------------------------------------------------------------

create or replace function crear_bobina(
  p_maquina_id    uuid,
  p_operario_id   uuid,
  p_kilos         numeric,
  p_ancho_cm      numeric default null,
  p_micrones      numeric default null,
  p_observaciones text default null
)
returns bobinas
language plpgsql
security invoker
as $$
declare
  v_corrida    corridas_maquina;
  v_ancho      numeric;
  v_micrones   numeric;
  v_momento    timestamp;
  v_turno      text;
  v_jornada    date;
  v_numero_maq integer;
  v_conteo     integer;
  v_bobina     bobinas;
begin
  if p_kilos is null or p_kilos <= 0 then
    raise exception 'Los kilos tienen que ser mayores a cero.';
  end if;

  select numero into v_numero_maq from maquinas where id = p_maquina_id;

  if v_numero_maq is null then
    raise exception 'Esa máquina no tiene número cargado. Ponéselo en Configuración: el número es parte del número de bobina.';
  end if;

  select * into v_corrida
    from corridas_maquina
   where maquina_id = p_maquina_id and finalizada_en is null;

  if p_ancho_cm is not null and p_micrones is not null then
    v_corrida  := definir_corrida(p_maquina_id, p_ancho_cm, p_micrones, null);
    v_ancho    := p_ancho_cm;
    v_micrones := p_micrones;
  elsif v_corrida.id is not null then
    v_ancho    := v_corrida.ancho_cm;
    v_micrones := v_corrida.micrones;
  else
    raise exception 'Esa máquina todavía no tiene cargado qué está produciendo.';
  end if;

  -- Este UPDATE bloquea la fila de la máquina mientras incrementa: es lo que
  -- garantiza que dos bobinas simultáneas de la misma máquina no repitan.
  update maquinas
     set contador_bobinas = contador_bobinas + 1
   where id = p_maquina_id
  returning contador_bobinas into v_conteo;

  v_momento := ahora_argentina();
  select t.turno, t.jornada into v_turno, v_jornada from turno_y_jornada(v_momento) t;

  insert into bobinas (
    numero_bobina, numero_en_maquina, maquina_id, operario_id, corrida_id,
    ancho_cm, micrones, kilos,
    turno, fecha, hora, fecha_produccion, observaciones
  )
  values (
    -- "06-00123": máquina y conteo de esa máquina, único en todo el sistema.
    lpad(v_numero_maq::text, 2, '0') || '-' || lpad(v_conteo::text, 5, '0'),
    v_conteo,
    p_maquina_id, p_operario_id, v_corrida.id,
    v_ancho, v_micrones, p_kilos,
    v_turno, v_momento::date, v_momento::time, v_jornada,
    nullif(btrim(coalesce(p_observaciones, '')), '')
  )
  returning * into v_bobina;

  return v_bobina;
end;
$$;

revoke execute on function crear_bobina(uuid, uuid, numeric, numeric, numeric, text)
  from public, anon;
grant execute on function crear_bobina(uuid, uuid, numeric, numeric, numeric, text)
  to authenticated;

-- ----------------------------------------------------------------------------
--  Si querés arrancar el conteo de una máquina en otro número (por ejemplo
--  porque venían contando a mano), corré esto una vez por máquina:
--
--      update maquinas set contador_bobinas = 340 where numero = 6;
--
--  La próxima bobina de la 6 va a salir 06-00341.
--
--  Y si las bobinas que hay son solo de prueba y querés empezar limpio:
--
--      delete from impresiones where bobina_id is not null;
--      delete from bobinas;
--      update maquinas set contador_bobinas = 0;
-- ----------------------------------------------------------------------------

select m.numero, m.nombre, m.contador_bobinas
  from maquinas m order by m.numero nulls last;
