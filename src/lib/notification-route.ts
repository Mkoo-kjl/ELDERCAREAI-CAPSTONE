/** Push payloads may open only the care destinations supported by this build. */
export function careNotificationRoute(data:Record<string,unknown>|null|undefined):string|null{
  const url=data?.url;if(typeof url!=='string')return null;
  if(url==='/location')return url;
  if(/^\/alerts(?:\?tab=(?:Alerts|Notifications|Emergency))?$/.test(url))return url;
  if(/^\/care(?:\?tab=(?:Medications|Appointments|Notes))?$/.test(url))return url;
  if(/^\/alert-response\?id=[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(url))return url;
  return null;
}
