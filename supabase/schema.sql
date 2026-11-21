-- Execute uma vez no SQL Editor do projeto Supabase.
-- Schema separado para não misturar com outros aplicativos na mesma conta.
BEGIN;
CREATE SCHEMA IF NOT EXISTS benicio;
REVOKE ALL ON SCHEMA benicio FROM PUBLIC,anon,authenticated;
GRANT USAGE ON SCHEMA benicio TO service_role;
CREATE TABLE IF NOT EXISTS benicio.families(id text PRIMARY KEY,name text NOT NULL,companions jsonb NOT NULL,diaper text NOT NULL,created timestamptz NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS benicio.gifts(id text PRIMARY KEY,name text NOT NULL,image text NOT NULL,url text NOT NULL,capacity integer NOT NULL CHECK(capacity>0),created timestamptz NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS benicio.reservations(family_id text PRIMARY KEY REFERENCES benicio.families(id),gift_id text NOT NULL REFERENCES benicio.gifts(id));
CREATE INDEX IF NOT EXISTS reservations_gift ON benicio.reservations(gift_id);
CREATE TABLE IF NOT EXISTS benicio.settings(id integer PRIMARY KEY CHECK(id=1),date text NOT NULL DEFAULT '',time text NOT NULL DEFAULT '',location text NOT NULL DEFAULT '');
INSERT INTO benicio.settings(id) VALUES(1) ON CONFLICT DO NOTHING;
CREATE TABLE IF NOT EXISTS benicio.sessions(token text PRIMARY KEY,scope text NOT NULL,expires timestamptz NOT NULL);
CREATE TABLE IF NOT EXISTS benicio.login_attempts(ip text PRIMARY KEY,n integer NOT NULL,expires timestamptz NOT NULL);
ALTER TABLE benicio.families ENABLE ROW LEVEL SECURITY;
ALTER TABLE benicio.gifts ENABLE ROW LEVEL SECURITY;
ALTER TABLE benicio.reservations ENABLE ROW LEVEL SECURITY;
ALTER TABLE benicio.settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE benicio.sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE benicio.login_attempts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON ALL TABLES IN SCHEMA benicio FROM PUBLIC,anon,authenticated;
GRANT SELECT,INSERT,UPDATE,DELETE ON ALL TABLES IN SCHEMA benicio TO service_role;

CREATE OR REPLACE FUNCTION public.benicio_api(p_action text,p_data jsonb DEFAULT '{}'::jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE
 result jsonb;
 family_row benicio.families%ROWTYPE;
 gift_row benicio.gifts%ROWTYPE;
 chosen text;
 attempt_count integer;
 gift_list jsonb;
BEGIN
 IF p_action='login_attempt' THEN
  DELETE FROM benicio.login_attempts WHERE expires<now();
  DELETE FROM benicio.sessions WHERE expires<now();
  INSERT INTO benicio.login_attempts(ip,n,expires) VALUES(p_data->>'ip',1,now()+interval '15 minutes')
  ON CONFLICT(ip) DO UPDATE SET n=benicio.login_attempts.n+1 RETURNING n INTO attempt_count;
  -- Retorna o bloqueio sem lançar exceção, para manter a contagem persistida.
  RETURN jsonb_build_object('blocked',attempt_count>20);
 END IF;
 IF p_action='session' THEN
  INSERT INTO benicio.sessions VALUES(p_data->>'token',p_data->>'scope',now()+interval '8 hours');
  RETURN '{"ok":true}'::jsonb;
 END IF;
 IF p_action IN ('admin','event','gift_add','gift_delete') THEN
  IF NOT EXISTS(SELECT 1 FROM benicio.sessions WHERE token=p_data->>'token' AND scope=p_data->>'scope' AND expires>now()) THEN
   RAISE EXCEPTION 'Entre no painel para continuar.' USING DETAIL='401';
  END IF;
 END IF;
 IF p_action IN ('rsvp','reserve','gift_delete') THEN
  -- Serializa essas gravações entre instâncias, dentro da transação da RPC.
  PERFORM pg_catalog.pg_advisory_xact_lock(741826309);
 END IF;
 IF p_action='rsvp' THEN
  SELECT size INTO chosen FROM (VALUES('RN',1,0),('P',4,1),('M',35,2),('G',35,3),('XG',20,4)) AS sizes(size,weight,ord)
  ORDER BY ((SELECT count(*)+1 FROM benicio.families)*weight/95.0-(SELECT count(*) FROM benicio.families WHERE diaper=size)) DESC,ord LIMIT 1;
  INSERT INTO benicio.families(id,name,companions,diaper) VALUES(p_data->>'id',p_data->>'name',p_data->'companions',chosen);
  RETURN jsonb_build_object('id',p_data->>'id');
 ELSIF p_action='event' THEN
  UPDATE benicio.settings SET date=p_data->>'date',time=p_data->>'time',location=p_data->>'location' WHERE id=1;
  RETURN '{"ok":true}'::jsonb;
 ELSIF p_action='gift_add' THEN
  INSERT INTO benicio.gifts(id,name,image,url,capacity) VALUES(p_data->>'id',p_data->>'name',p_data->>'image',p_data->>'url',(p_data->>'capacity')::integer);
  RETURN '{"ok":true}'::jsonb;
 ELSIF p_action='gift_delete' THEN
  IF EXISTS(SELECT 1 FROM benicio.reservations WHERE gift_id=p_data->>'id') THEN RAISE EXCEPTION 'Este mimo já tem reservas.' USING DETAIL='400'; END IF;
  DELETE FROM benicio.gifts WHERE id=p_data->>'id';
  RETURN '{"ok":true}'::jsonb;
 ELSIF p_action IN ('family','reserve') THEN
  SELECT * INTO family_row FROM benicio.families WHERE id=p_data->>'id';
  IF NOT FOUND THEN RAISE EXCEPTION 'Confirmação não encontrada.' USING DETAIL='404'; END IF;
  IF p_action='reserve' THEN
   SELECT * INTO gift_row FROM benicio.gifts WHERE id=p_data->>'giftId';
   IF NOT FOUND THEN RAISE EXCEPTION 'Mimo não encontrado.' USING DETAIL='404'; END IF;
   IF EXISTS(SELECT 1 FROM benicio.reservations WHERE family_id=family_row.id AND gift_id=gift_row.id) THEN RETURN '{"ok":true}'::jsonb; END IF;
   IF (SELECT count(*) FROM benicio.reservations WHERE gift_id=gift_row.id)>=gift_row.capacity THEN RAISE EXCEPTION 'Esse mimo acabou de ser reservado. Escolha outro.' USING DETAIL='409'; END IF;
   INSERT INTO benicio.reservations VALUES(family_row.id,gift_row.id) ON CONFLICT(family_id) DO UPDATE SET gift_id=excluded.gift_id;
   RETURN '{"ok":true}'::jsonb;
  END IF;
 END IF;
 IF p_action IN ('admin','family') THEN
  SELECT coalesce(jsonb_agg(to_jsonb(g)||jsonb_build_object('reserved',(SELECT count(*) FROM benicio.reservations WHERE gift_id=g.id)) ORDER BY g.created,g.id),'[]'::jsonb) INTO gift_list FROM benicio.gifts g;
  result=jsonb_build_object('gifts',gift_list,'event',(SELECT to_jsonb(s) FROM benicio.settings s WHERE id=1));
  IF p_action='admin' THEN
   RETURN result||jsonb_build_object('families',(SELECT coalesce(jsonb_agg(to_jsonb(f)||jsonb_build_object('giftId',r.gift_id) ORDER BY f.created DESC),'[]'::jsonb) FROM benicio.families f LEFT JOIN benicio.reservations r ON r.family_id=f.id));
  END IF;
  RETURN result||jsonb_build_object('family',to_jsonb(family_row)||jsonb_build_object('giftId',(SELECT gift_id FROM benicio.reservations WHERE family_id=family_row.id)));
 END IF;
 RAISE EXCEPTION 'Não encontrado.' USING DETAIL='404';
END;
$$;
REVOKE ALL ON FUNCTION public.benicio_api(text,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.benicio_api(text,jsonb) TO service_role;
COMMIT;

-- Disponibiliza somente data, horario e local para a pagina inicial.
-- Preserva todos os dados. A chave secreta continua apenas no servidor Vercel.
BEGIN;
CREATE OR REPLACE FUNCTION public.benicio_public_event()
RETURNS jsonb LANGUAGE sql STABLE SECURITY INVOKER SET search_path = '' AS $$
 SELECT jsonb_build_object('event',jsonb_build_object('date',date,'time',time,'location',location))
 FROM benicio.settings WHERE id=1;
$$;
REVOKE ALL ON FUNCTION public.benicio_public_event() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.benicio_public_event() TO service_role;
COMMIT;
