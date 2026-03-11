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
- [DONE] create "generate api key" page on admin UI
- [DONE] Modify tests to work with the auth system
- [DONE] Connect api to frontend
- [DONE] Track in database the n of times a SPECIFIC AGENT calls a callee to count "waterings"
- [DONE] Create table to track goals assignation to a specific period of time 
- [DONE] Not send the keys on register, instead, add an endpoint to generate them specifically for each app. (leaddesk, etc) and make the frontend ui for this
- [DONE]some UI component does not seems okay in both modes light-dark
- [DONE] can not just delete users because calls will be like Batman (no parents) -> Implement a pause flag and filter on the query
- create new conversion funnel endpoint and adapt frontend graph to it 
- [DONE] create endpoint for user comparisson page 
- [DONE] add inputs to get latest data date
- [DONE] modify blocks schemas. Now only 1 type -> daily
- [DONE] add "considered days" filters to datavis per block 
- [DONE] Build goals assignation UI
- [DONE] Modify blocks schema -> remove TYPE no is only daily. And build assignation db and logic, and build UI for this 
- [DONE] Confusing userId with agentId/managerId in some parts 
- [DONE]  schema routes unprotected by roles 
- create endpoint and frontend view to shared team performance for big screen
- [DONE] Store Leaddesk AUTH token (32 bytes) to being able to call the leaddesk API. -> ALSO, add interface for this, and this new step on the connection guide 
- Create endpoint to fetch all specific user data to uncomment sections on agent handling page 
- Use the leaddesk auth token to fetch for call data on webhook 
- rewrite test suites for routes and write integration tests 

## REMEMBER
- Now funnel is different, you can calculate all using the current webhook -> seeds, watering, harvest  


## Deployment info
- Actually, back and front deployed on vercel. PostgreDB deployed on Supabase. 
- Backend uses env variables to set DB url 
- Frontend uses env variables to set API url