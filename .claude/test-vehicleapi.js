// test-vehicleapi.js — SOAP version
const plate    = 'WXX7385'          // sample plate from their docs
const username = 'freddie88'    // your regcheck/vehicleapi login
const password = 'Invisible4v!'

const soapBody = `<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
  <soap:Body>
    <CheckMalaysia xmlns="http://regcheck.org.uk/" xmlns:reg="http://regcheck.org.uk/">
      <reg:RegistrationNumber>${plate.replace(/\s+/g, '')}</reg:RegistrationNumber>
      <reg:username>${username}</reg:username>
    </CheckMalaysia>
  </soap:Body>
</soap:Envelope>`

async function getWsdlSoapAction() {
  const wsdl = await fetch('https://www.regcheck.org.uk/api/reg.asmx?wsdl').then(r => r.text())
  const matches = [...wsdl.matchAll(/soapAction="([^"]+)"/g)]
  const malaysia = matches.find(m => m[1].toLowerCase().includes('malaysia'))
  if (malaysia) console.log('Malaysia soapAction:', malaysia[1])

  // Extract parameter names for CheckMalaysia
  const elementMatch = wsdl.match(/<[^>]*name="CheckMalaysia"[^>]*>[\s\S]*?<\/[^>]*element>/)
  if (elementMatch) {
    console.log('\nCheckMalaysia element definition:')
    console.log(elementMatch[0].substring(0, 500))
  } else {
    // Try to find it a different way
    const idx = wsdl.indexOf('CheckMalaysia')
    if (idx > -1) {
      console.log('\nCheckMalaysia context in WSDL:')
      console.log(wsdl.substring(idx - 50, idx + 400))
    }
  }
}

async function testGet() {
  // Try HTTP GET (simpler than SOAP for ASMX)
  const url = `https://www.regcheck.org.uk/api/reg.asmx/CheckMalaysia?RegistrationNumber=${plate.replace(/\s+/g,'')}&username=${encodeURIComponent(username)}`
  console.log('\n--- Trying HTTP GET ---')
  console.log('URL:', url)
  const res = await fetch(url)
  console.log('Status:', res.status)
  const text = await res.text()
  const match = text.match(/<vehicleJson[^>]*>([\s\S]*?)<\/vehicleJson>/)
  if (match) {
    const raw = match[1].replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&amp;/g,'&')
    try { console.log(JSON.stringify(JSON.parse(raw), null, 2)) } catch { console.log(raw) }
  } else {
    console.log(text)
  }
}

async function test() {
  await getWsdlSoapAction()
  await testGet()

  console.log('\n--- Trying SOAP POST ---')
  const res = await fetch('https://www.regcheck.org.uk/api/reg.asmx', {
    method: 'POST',
    headers: {
      'Content-Type': 'text/xml; charset=utf-8',
      'SOAPAction':   '"http://regcheck.org.uk/CheckMalaysia"',
    },
    body: soapBody,
  })

  console.log('HTTP status:', res.status)
  const text = await res.text()
  const match = text.match(/<vehicleJson[^>]*>([\s\S]*?)<\/vehicleJson>/)
  if (match) {
    const raw = match[1].replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&amp;/g,'&')
    try { console.log(JSON.stringify(JSON.parse(raw), null, 2)) } catch { console.log(raw) }
  } else {
    console.log('\nFull response:')
    console.log(text)
  }
}

test().catch(console.error)
