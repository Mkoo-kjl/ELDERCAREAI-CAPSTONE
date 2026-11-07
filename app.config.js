// Optional Firebase Android client config, supplied as an EAS file environment variable.
// The Firebase service-account private key belongs in EAS credentials, never in the app.
module.exports = ({config}) => {
  const fs=require('node:fs');
  const clientFile=process.env.GOOGLE_SERVICES_JSON||(fs.existsSync('./google-services.json')?'./google-services.json':undefined);
  return {...config,extra:{...config.extra,firebaseConfigured:Boolean(clientFile)},android:{...config.android,...(clientFile?{googleServicesFile:clientFile}:{})}};
};
