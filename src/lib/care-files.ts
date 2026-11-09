import {supabase} from './supabase';
import type {LocalPhoto} from '@/src/components/ProfilePhotoPicker';
export const CARE_FILE_BUCKET='care-files';
export async function uploadCareFile(userId:string,patientId:string,kind:'medication'|'prescription',photo:LocalPhoto){
  const {data,error}=await supabase.auth.getUser();
  if(error||data.user?.id!==userId)throw Error('Your session changed. Sign in again before uploading.');
  const mime=photo.mimeType??'image/jpeg';
  if(!['image/jpeg','image/png','image/webp'].includes(mime))throw Error('Select a JPG, PNG or WebP image.');
  const response=await fetch(photo.uri);
  if(!response.ok)throw Error('The selected image could not be read. Select it again.');
  const bytes=await response.arrayBuffer();
  if(!bytes.byteLength||bytes.byteLength>10*1024*1024)throw Error('Select a clear image smaller than 10 MB.');
  const extension=mime==='image/png'?'png':mime==='image/webp'?'webp':'jpg';
  const path=`${userId}/${patientId}/${kind}-${Date.now()}-${Math.random().toString(36).slice(2)}.${extension}`;
  const result=await supabase.storage.from(CARE_FILE_BUCKET).upload(path,bytes,{contentType:mime,upsert:false});
  if(result.error)throw Error(`Image upload failed: ${result.error.message}`);
  return path;
}
export async function careFileUrl(path:string,userId:string){
  if(!path.startsWith(`${userId}/`))throw Error('This image belongs to another account.');
  const {data,error}=await supabase.storage.from(CARE_FILE_BUCKET).createSignedUrl(path,3600);
  if(error)throw Error('The private image could not be loaded. Try refreshing.');
  return data.signedUrl;
}
