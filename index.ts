import app from "./app"

import listEndpoints from 'express-list-endpoints';


const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`🚀 Server is running at http://localhost:${PORT}`);
  console.log(listEndpoints(app));
});
