const fs = require('fs');
const stravaApi = require('strava-v3');
const opn = require('open');
const readline = require('readline').createInterface({
  input: process.stdin,
  output: process.stdout
});
const _ = require('lodash');

const tokenFile = 'data/tokens.json';
let tokens = {
   accessToken: '',
   refreshToken: '',
};

if (fs.existsSync(tokenFile)) {
   tokens = JSON.parse(fs.readFileSync(tokenFile));
   console.warn('got tokens', tokens);
}

const authUrl = stravaApi.oauth.getRequestAccessURL({
   scope: 'read_all,activity:read_all,activity:write,profile:read_all,profile:write'
});
console.warn(authUrl);

function updateTokens(resp) {
   tokens.accessToken = resp.access_token;
   tokens.refreshToken = resp.refresh_token;
   console.warn('updated tokens', tokens);
   fs.writeFileSync(tokenFile, JSON.stringify(tokens));
}

async function getClient() {
   let client = new stravaApi.client(tokens.accessToken);
   try {
      await client.athlete.get();
   } catch (e) {
      console.warn(e.error);
      if (_.some(e.error.errors, err => {
         return err.field === 'access_token' && err.code === 'invalid';
      })) {
         try {
            console.warn('refreshing token...');
            const resp = await stravaApi.oauth.refreshToken(tokens.refreshToken);
            console.warn(`resp`, resp);
            console.warn(`access_token: ${resp.access_token}`);
            console.warn(`refresh_token: ${resp.refresh_token}`);
            console.warn(`athlete:`, resp.athlete);
            updateTokens(resp);

            return await getClient();
         } catch (e) {
            console.warn(e.error);
            console.warn('refresh token failed, reauthorizing');
            return await authorize();
         }
      }
   }

   return client;
}

async function authorize() {
   const res = await opn(authUrl, {
      url: authUrl,
      wait: true,
      app: '/mnt/c/Program Files (x86)/Google/Chrome/Application/chrome.exe',
   });

   const p = new Promise(resolve => {
      readline.question('Authorization code: ', code => {
         console.warn(`got ${code}`);
         resolve(code);
      });
   });

   const code = await p;

   console.warn('getting token...');

   const resp = await stravaApi.oauth.getToken(code);
   console.warn(`resp`, resp);
   console.warn(`access_token: ${resp.access_token}`);
   console.warn(`refresh_token: ${resp.refresh_token}`);
   console.warn(`athlete:`, resp.athlete);
   updateTokens(resp);

   return new stravaApi.client(tokens.accessToken);
}

(async () => {
   const client = await getClient();

   let athlete = await client.athlete.get();
   console.warn(athlete);

   let page = 1;
   const perPage = 200;
   let d = new Date();
   d.setTime(after);
   console.warn(d);

   try {
      let nextPage = true;
      while (nextPage) {
         const activities = await client.athlete.listActivities({
            page,
            per_page: perPage,
         });

         _.each(activities, async act => {
            console.warn(`activity: ${act.id}, ${act.name} on ${act.start_date_local}, type: ${act.type}`);
            console.warn('gear:', act.gear_id);
             
            nextPage = await updateActWithGear(client, act, 'g6607135');
            return nextPage; // aka break
         });

         page++;
      }
   } catch (e) {
      console.error(e);
   }

   readline.close();
})();

let after = Date.parse('2019-10-24');
async function updateActWithGear(client, act, gear) {
   if (act.type !== 'Run') {
      return true;
   }
   
   const d = new Date();
   d.setTime(Date.parse(act.start_date_local));

   if (d.getTime() < after) {
      // Stop checking activities
      return false;
   }

   console.warn('updating activity %s, %s ', act.id, act.name);
   const result = await client.activities.update({
      id: act.id,
      gear_id: gear,
   });

   console.warn('activity updated', result);
   return true;
}

async function makeActivityPublic(client, act) {
   if (act.private) {
      console.warn('updating activity %s, %s ', act.id, act.name);
      await client.activities.update({
         id: act.id,
         private: false,
      });

      console.warn('activity updated', result);
   }
}
