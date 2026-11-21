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
