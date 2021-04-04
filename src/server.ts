import express, { urlencoded } from 'express'

const PORT = process.env.PORT || 5000

const app = express()

//////////////////////////////////////////////////////////////////
//             EXPRESS SERVER SETUP FOR UPTIME ROBOT            //
//////////////////////////////////////////////////////////////////
app.use(urlencoded({ extended: true }))

app.use('/', (request, response) => {
  response.sendStatus(200)
})

app.listen(PORT, () => console.log(`Server started on port ${PORT}!`))
