npx prisma migrate dev --name init
npx prisma migrate deploy
npx prisma db push --accept-data-loss

docker compose up -d
docker compose stop: Pauses the DB. Data is kept.
docker compose down: Removes the container. Data is still kept because of the volumes setting.
docker compose down -v: Removes everything, including the data. Use this if you want a completely fresh start.


## Todos
- Implement authentication middleware and write specific tests
- Implement leaddesk webhook authentication 
- create "Add token" page on admin UI
- Modify tests to work with the auth system
- Connect api to frontend
- create endpoint and frontend view to shared team performance for big screen
- Track in database the n of times a SPECIFIC AGENT calls a callee to count "waterings"
