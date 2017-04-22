const strava = require('strava-v3');

const args = {
   per_page: 200,
   page: -1,
};

function handleActivityList(err, data, limits) {
   if (err) {
      console.error(err);
      return;
   }

   if (data.errors) {
      data.errors.forEach(err => console.error(err));
      return;
   }

   console.warn('activity data:', data);

   if (!data || data.length === 0) {
      return;
   }

   data.forEach((act, index) => {
      console.warn('activity number %s: %s, %s on %s',
         index, act.id, act.name, act.start_date_local
      );
      console.warn('activity private: %s', act.private);

      if (act.private) {
         console.warn('updating activity %s, %s ', act.id, act.name);
         strava.activities.update({
            id: act.id,
            private: false,
         }, (err, result) => {
            if (err) {
               console.error(err);
            } else {
               console.warn('activity updated', result);
            }
         });
      }
   });

   console.warn('activity limit:', limits);

   nextPageActivities();
}

function nextPageActivities() {
   args.page++;
   strava.athlete.listActivities(args, handleActivityList);
}

nextPageActivities();
