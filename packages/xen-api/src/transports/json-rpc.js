import httpRequestPlus from 'http-request-plus'
import { format, parse } from 'json-rpc-protocol'

import XapiError from '../_XapiError'

import UnsupportedTransport from './_UnsupportedTransport'

// https://github.com/xenserver/xenadmin/blob/0df39a9d83cd82713f32d24704852a0fd57b8a64/XenModel/XenAPI/Session.cs#L403-L433
export default ({ secureOptions, url, agent }) => {
  url = new URL('./jsonrpc', Object.assign(new URL('http://localhost'), url))

  return async function (method, args) {
    const res = await httpRequestPlus(url, {
      ...secureOptions,
      body: format.request(0, method, args),
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      method: 'POST',
      agent,
    }).catch(error => {
      console.warn('xen-api/transports/json-rpc', error)

      throw new UnsupportedTransport()
    })

    const text = await res.text()

    let response
    try {
      response = parse(text)
    } catch (error) {
      throw new UnsupportedTransport()
    }

    if (response.type === 'response') {
      return response.result
    }

    throw XapiError.wrap(response.error)
  }
}
