npx prisma migrate dev --name init
npx prisma migrate deploy
npx prisma db push --accept-data-loss

docker compose up -d
docker compose stop: Pauses the DB. Data is kept.
docker compose down: Removes the container. Data is still kept because of the volumes setting.
docker compose down -v: Removes everything, including the data. Use this if you want a completely fresh start.


## Todos
- [DONE] Implement authentication middleware and write specific tests
- [DONE] Implement leaddesk webhook authentication and api keys generation  
- [DONE] convert previous point into a middleware
- [DONE] all routes "companyId", "creator", etc params, should be taken from the auth token via middleware 
- create "generate api key" page on admin UI
- [DONE] Modify tests to work with the auth system
- Connect api to frontend
- create endpoint and frontend view to shared team performance for big screen
-
- [DONE] Track in database the n of times a SPECIFIC AGENT calls a callee to count "waterings"
- [DONE] Create table to track goals assignation to a specific period of time 
- Not send the keys on register, instead, add an endpoint to generate them specifically for each app. (leaddesk, etc) and make the frontend ui for this
- Create endpoint to fetch all specific user data to uncomment sections on agent handling page 
- some UI component does not seems okay in both modes light-dark
- can not just delete users because calls will be like Batman (no parents) -> Implement a pause flag and filter on the query

## REMEMBER
- Now funnel is different, you can calculate all using the current webhook -> seeds, watering, harvest 
- agentId of the agent table must be the same than the one in leaddesk 