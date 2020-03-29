const { Client, MessageMedia } = require('whatsapp-web.js')
const MongoClient = require('mongodb').MongoClient
const fs = require('fs-extra')
const schedule = require('node-schedule')

// Moment Settings
const moment = require('moment')
require('moment/locale/id')
moment.locale('id')

// My Local Library
const helpers = require('./lib/helpers')

const SESSION_FILE_PATH = './session.json'
let sessionCfg;
if (fs.existsSync(SESSION_FILE_PATH)) {
    sessionCfg = require(SESSION_FILE_PATH)
}

// MongoDB Initialize
const DB_OPTIONS = { poolSize: 50, keepAlive: 15000, socketTimeoutMS: 15000, connectTimeoutMS: 15000, useNewUrlParser: true, useUnifiedTopology: true }
const DB_CONN = 'mongodb+srv://db' // Connection String MongoDB
let db

// Fungsi input data registrasi
const insertDataUsers = (db, author) => new Promise((resolve, reject) => {
    const allRecords = db.collection('corona').insertOne({ phone_number: author })
    if (!allRecords) {
        reject('Error Mongo', allRecords)
    } else {
        resolve(allRecords)
    }
})

// Fungsi hapus data registrasi
const deleteDataUsers = (db, author) => new Promise((resolve, reject) => {
    const allRecords = db.collection('corona').findOneAndDelete({ phone_number: author })
    if (!allRecords) {
        reject('Error Mongo', allRecords)
    } else {
        resolve(allRecords)
    }
})

// Fungsi membaca data registrasi
const getDataUsers = (db, author) => new Promise((resolve, reject) => {
    const allRecords = db.collection('corona').find({ phone_number: author }).toArray()
    if (!allRecords) {
        reject('Error Mongo', allRecords)
    } else {
        resolve(allRecords)
    }
})

// Fungsi membaca semua data registrasi
const getAllDataUsers = (db) => new Promise((resolve, reject) => {
    const allRecords = db.collection('corona').find({}).toArray()
    if (!allRecords) {
        reject('Error Mongo', allRecords)
    } else {
        resolve(allRecords)
    }
})

const client = new Client({ puppeteer: { headless: true }, session: sessionCfg })
client.initialize()

client.on('authenticated', (session) => {
    sessionCfg = session
    fs.writeFile(SESSION_FILE_PATH, JSON.stringify(session), function (err) {
        if (err) console.log(err)
    })
})

client.on('ready', async () => {
    console.log('[INFO] Bot sudah siap digunakan...')
    const dbClient = await MongoClient.connect(DB_CONN, DB_OPTIONS)
    db = dbClient.db('kawalcovid')
    console.log('[INFO] Berhasil terkoneksi dengan server database...')

    let getDataDaily = []
    let getDaily = await helpers.getDailyCoronaIndonesia()
    getDataDaily.push({
        Jumlah_Kasus_Baru_per_Hari: getDaily.Jumlah_Kasus_Baru_per_Hari,
        Jumlah_Kasus_Kumulatif: getDaily.Jumlah_Kasus_Kumulatif,
        Jumlah_pasien_dalam_perawatan: getDaily.Jumlah_pasien_dalam_perawatan
    })

    schedule.scheduleJob('*/1 * * * *', async function() {
        let getNewDaily = await helpers.getDailyCoronaIndonesia()
        getDataDaily.map(async item => {
            if (item.Jumlah_Kasus_Baru_per_Hari !== getNewDaily.Jumlah_Kasus_Baru_per_Hari ||
                item.Jumlah_Kasus_Kumulatif !== getNewDaily.Jumlah_Kasus_Kumulatif ||
                item.Jumlah_pasien_dalam_perawatan !== getNewDaily.Jumlah_pasien_dalam_perawatan) {
                let getListUsers = await getAllDataUsers(db)
                getListUsers.map(async item => {
                    const [canvasCorona, coronaData ] = await Promise.all([ helpers.generateCanvasId(), helpers.getAllCoronaGlobal() ])
                    const message = `_Update Terakhir : ${canvasCorona.update}_\n\n*Global (Seluruh Dunia) :*\n\n● Terkonfirmasi: ${coronaData[0]['Confirmed cases']} Orang 😧\n● Sembuh: ${coronaData[0].Recovered} Orang 😍\n● Meninggal: ${coronaData[0].Deaths} Orang 😢\n\nKetik */help* untuk melihat daftar menu lainnya\n\nAyo cegah corona dengan *#DirumahAja*`;
                    await client.sendMessage(item.phone_number, new MessageMedia('image/jpeg', canvasCorona.uri, moment().format('coronaId-hh:mm:ss')))
                    await client.sendMessage(item.phone_number, message)
                })

                // Update data baru ke temp array
                getDataDaily = []
                getDataDaily.push({
                    Jumlah_Kasus_Baru_per_Hari: getNewDaily.Jumlah_Kasus_Baru_per_Hari,
                    Jumlah_Kasus_Kumulatif: getNewDaily.Jumlah_Kasus_Kumulatif,
                    Jumlah_pasien_dalam_perawatan: getNewDaily.Jumlah_pasien_dalam_perawatan
                })
            }
        })
    })
})

client.on('message', async (msg) => {
    // Log Debug
    console.log(`${moment().format('DD/MM/YYYY HH:mm:ss')} ~ ${msg.from}: ${msg.body}`)

    if (msg.body == '/help') {
        const message = `*KawalCovid19 - BOT*\n-- Online 24 Jam --\n\nCommand / Perintah :\n\n1. *#info* untuk melihat seluruh kasus corona\n2. *#info nama_negara* misal *#info indonesia* untuk memunculkan kasus corona berdasarkan negara. Apabila anda ingin melihat daftar negara yang tersedia ketikan *#daftar_negara*\n3. *#subscribe* untuk mendaftarkan nomor hp anda agar mendapatkan notifikasi terkini terkait perubahan jumlah kasus *Covid19*\n`
        client.sendMessage(msg.from, message)
    }

    if (/\s/.test(msg.body)) {
        if (msg.body.split(' ')[0].toLowerCase() == '#info') {
            const newBody = msg.body.slice(6)
            const coronaData = await helpers.getAllCoronaGlobal()
            const findData = coronaData.find((data) => {
                var pattern = new RegExp(newBody, 'gi')
                var match = data.Location.match(pattern)
                return match
            })

            if (findData) {
                const message = `*Informasi Detail ${newBody}*\n\n● Terkonfirmasi: ${findData['Confirmed cases']} Orang 😧\n● Sembuh: ${findData.Recovered} Orang 😍\n● Meninggal: ${findData.Deaths} Orang 😢\n\nKetik */help* untuk melihat daftar menu lainnya\n\nAyo cegah corona dengan *#DirumahAja*`;
                msg.reply(message)
            } else {
                const message = `*Oops Nama Negara tidak ditemukan 😷*\n\nKetik */help* untuk melihat daftar menu lainnya\n\nAyo cegah corona dengan *#DirumahAja*`
                msg.reply(message)
            }
        }
    }

    if (msg.body == '#info') {
        const [canvasCorona, coronaData ] = await Promise.all([ helpers.generateCanvasId(), helpers.getAllCoronaGlobal() ])
        const message = `_Update Terakhir : ${canvasCorona.update}_\n\n*Global (Seluruh Dunia) :*\n\n● Terkonfirmasi: ${coronaData[0]['Confirmed cases']} Orang 😧\n● Sembuh: ${coronaData[0].Recovered} Orang 😍\n● Meninggal: ${coronaData[0].Deaths} Orang 😢\n\nKetik */help* untuk melihat daftar menu lainnya\n\nAyo cegah corona dengan *#DirumahAja*`;
        await client.sendMessage(msg.from, new MessageMedia('image/jpeg', canvasCorona.uri, moment().format('coronaId-hh:mm:ss')))
        await client.sendMessage(msg.from, message)
    }

    if (msg.body == '#daftar_negara') {
        let daftarNegara = []
        const coronaData = await helpers.getAllCoronaGlobal()
        coronaData.map(item => daftarNegara.push(`▪ ${item.Location.charAt(0).toUpperCase() + item.Location.slice(1)}`))
        await client.sendMessage(msg.from, daftarNegara.join('\n'))
    }

    if (msg.body == '#subscribe') {
        let chat = await msg.getChat()
        // Cek & Input data ke MongoDB
        const dbDataUsers = await getDataUsers(db, chat.isGroup ? msg.from = msg.author : msg.from = msg.from)
        if (msg.body && dbDataUsers.length<1) {
            dbDataUsers.push(chat.isGroup ? msg.from = msg.author : msg.from = msg.from)
            await insertDataUsers(db, chat.isGroup ? msg.from = msg.author : msg.from = msg.from)
            await client.sendMessage(msg.from, `Selamat, nomor hp anda "${msg.from.split('@c.us')[0]}" berhasil diregistrasi kedalam daftar *#DailyShare*...\n\nUntuk membatalkan silahkan ketik *#unsubscribe*`)
        } else {
            await client.sendMessage(msg.from, `Maaf, nomor hp anda "${msg.from.split('@c.us')[0]}" telah diregistrasi...\n\nUntuk membatalkan silahkan ketik *#unsubscribe*`)
        }
    }

    if (msg.body == '#unsubscribe') {
        let chat = await msg.getChat()
        // Cek & Hapus data ke MongoDB
        const dbDataUsers = await getDataUsers(db, chat.isGroup ? msg.from = msg.author : msg.from = msg.from)
        if (msg.body && dbDataUsers.length<1) {
            await client.sendMessage(msg.from, 'Oopps, nNomor hp anda belum diregistrasi')
        } else {
            await deleteDataUsers(db, chat.isGroup ? msg.from = msg.author : msg.from = msg.from)
            await client.sendMessage(msg.from, 'Nomor hp anda telah dihapus dari daftar *#DailyShare*')
        }
    }
})

client.on('message_create', async (msg) => {
    if (msg.fromMe) {
        if (msg.body == '#blast') {
            let getListUsers = await getAllDataUsers(db)
            getListUsers.map(async item => {
                const [canvasCorona, coronaData ] = await Promise.all([ helpers.generateCanvasId(), helpers.getAllCoronaGlobal() ])
                const message = `_Update Terakhir : ${canvasCorona.update}_\n\n*Global (Seluruh Dunia) :*\n\n● Terkonfirmasi: ${coronaData[0]['Confirmed cases']} Orang 😧\n● Sembuh: ${coronaData[0].Recovered} Orang 😍\n● Meninggal: ${coronaData[0].Deaths} Orang 😢\n\nKetik */help* untuk melihat daftar menu lainnya\n\nAyo cegah corona dengan *#DirumahAja*`;
                await client.sendMessage(item.phone_number, new MessageMedia('image/jpeg', canvasCorona.uri, moment().format('coronaId-hh:mm:ss')))
                await client.sendMessage(item.phone_number, message)
            })
        }
    }
})

client.on('disconnected', (reason) => console.log('[INFO] Bot Telah Berhenti ', reason))