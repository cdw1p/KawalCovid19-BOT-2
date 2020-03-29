const { createCanvas, registerFont, loadImage } = require('canvas')
const fetch = require('node-fetch')
const fs = require('fs-extra')
const cheerio = require('cheerio')
const tabletojson = require('tabletojson').Tabletojson

// Moment Settings
const moment = require('moment')
require('moment/locale/id')

const getAllCoronaIndonesia = () => new Promise((resolve, reject) => {
    fetch('https://www.worldometers.info/coronavirus/country/indonesia/', { method:'GET' })
    .then(res => res.text())
    .then(res => {
        const newData = []
        const $ = cheerio.load(res)
        const timeFormat = $('div[style="font-size:13px; color:#999; text-align:center"]').text().split('Last updated: ')[1]
        $('div > div.maincounter-number > span').each(function() {
            newData.push($(this).text())
        })
        resolve({
            data: newData,
            update: timeFormat
        })
    })
    .catch(err => reject(err))
})

const getDailyCoronaIndonesia = () => new Promise((resolve, reject) => {
    fetch(`https://services5.arcgis.com/VS6HdKS0VfIhv8Ct/arcgis/rest/services/Statistik_Perkembangan_COVID19_Indonesia/FeatureServer/0/query?f=json&where=Tanggal%3Ctimestamp%20%27${moment().format('YYYY-MM-DD')}%2017%3A00%3A00%27&returnGeometry=false&spatialRel=esriSpatialRelIntersects&outFields=*&orderByFields=Tanggal%20asc&outSR=102100&resultOffset=0&resultRecordCount=2000&cacheHint=true`, { method:'GET' })
    .then(res => res.json())
    .then(res => {
        resolve(res.features[res.features.length-1].Jumlah_Kasus_Sembuh_per_Hari==null ? res.features[res.features.length-2].attributes : res.features[res.features.length-1].attributes)
    })
    .catch(err => reject(err))
})

const getAllCoronaGlobal = () => new Promise((resolve, reject) => {
    fetch('https://google.org/crisisresponse/covid19-map', { method:'GET' })
    .then(res => res.text())
    .then(res => {
        const allTable = tabletojson.convert(res)
        const tableCovid = allTable[1]
        const newResult = []
        tableCovid.map(datas => {
            newResult.push({ 
                Location: datas.Location.toLowerCase(),
                'Confirmed cases': datas['Confirmed cases'],
                Recovered: datas.Recovered,
                Deaths: datas.Deaths
            })
        })
        resolve(newResult)
    })
    .catch(err => reject(err))
})

const generateCanvasId = () => new Promise(async (resolve, reject) => {
    const [allCorona, dailyCorona ] = await Promise.all([ getAllCoronaIndonesia(), getDailyCoronaIndonesia() ])

    // Canvas Settings
    const canvas = createCanvas(600, 600)
    const ctx = canvas.getContext('2d')
    registerFont('./template/fonts/IBMPlexSans-Regular.ttf', { family: 'IBMPlexSans-Regular' })
    registerFont('./template/fonts/IBMPlexSans-Medium.ttf', { family: 'IBMPlexSans-Medium' })
    registerFont('./template/fonts/IBMPlexSans-Bold.ttf', { family: 'IBMPlexSans-Bold' })

    // Mengambil Gambar dari Template
    loadImage('./template/images/corona.jpg').then((image) => {
        ctx.drawImage(image, 0, 0)
        // Tanggal
        ctx.font = '30px "IBMPlexSans-Bold"'
        ctx.fillStyle = '#332C2B';
        ctx.fillText(`Tanggal : ${moment().locale('id').format('LL')}`, 145, 200)
        // Update Hari Ini
        ctx.font = '15px "IBMPlexSans-Medium"'
        ctx.fillStyle = '#fff';
        ctx.fillText(`${dailyCorona.Jumlah_Kasus_Dirawat_per_Hari} Orang`, 190, 307)
        ctx.fillText(`${dailyCorona.Jumlah_Kasus_Sembuh_per_Hari} Orang`, 190, 326)
        ctx.fillText(`${dailyCorona.Jumlah_Kasus_Meninggal_per_Hari} Orang`, 190, 345)
        // Total Positif
        ctx.font = '40px "IBMPlexSans-Bold"'
        ctx.fillStyle = '#fff';
        ctx.fillText(allCorona.data[0], 328, 322.5)
        // Total Sembuh
        ctx.font = '40px "IBMPlexSans-Bold"'
        ctx.fillStyle = '#fff';
        ctx.fillText(allCorona.data[2], 40, 463)
        // Total Meninggal
        ctx.font = '40px "IBMPlexSans-Bold"'
        ctx.fillStyle = '#fff';
        ctx.fillText(allCorona.data[1], 328, 463)
        // fs.writeFile('template.html', '<img src="' + canvas.toDataURL() + '" />')
        resolve({
            update: allCorona.update,
            uri: canvas.toDataURL().split('data:image/png;base64,')[1]
        })
    })
})

module.exports = {
    getDailyCoronaIndonesia,
    getAllCoronaIndonesia,
    getAllCoronaGlobal,
    generateCanvasId
}