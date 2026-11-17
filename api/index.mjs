import {handleSupabase} from '../apps/api/supabase.mjs';
export default async function handler(req,res){
 const result=await handleSupabase(req,process.env);
 res.statusCode=result.status;
 for(const [name,value]of Object.entries(result.headers))res.setHeader(name,value);
 res.end(JSON.stringify(result.data));
}
