// import axios from 'axios'
// // import qs from 'query-string'
// import qs from 'qs'
// import md5 from 'blueimp-md5'

const axios = require('axios')
const qs = require('qs')
const md5 = require('blueimp-md5')

/**
 * sinature
 */
const sign = function (data, key) {
	const keys = []
	for (let k in data) {
		if (data.hasOwnProperty(k)) {
			if (JSON.stringify(data[k]).length < 64) { // exclude value which very long
				keys.push(k)
			}
		}
	}
	let str = ''
	keys.sort()
	keys.forEach((key) => {
		str += (key + '=' + data[key] + '&')
	})
	str += 'key=' + key
	return md5(str).toUpperCase()
}

const defaults = {
	baseURL: '',
	basePath: '',
	headers: {},
	auth: {}
}

/**
 * Fetch
 */
class Fetch {
	constructor() {
		this.option = defaults

		this.axiosInstance = axios.create({
			timeout: 6000,
			withCredentials: false,
			headers: {
				'Accept': 'application/json, text/plain, */*',
				'Content-Type': 'application/json'
				// 'Access-Control-Allow-Origin': '*'
			},

			// transformResponse: [function(data) {
			// 	return JSON.parse(data);
			// }],

			// validateStatus: function (status) {
			// 	return status >= 200 && status < 300
			// }
		});
	}

	addRequestInterceptor(func) {
		this.axiosInstance.interceptors.request.use(func)
	}

	addResponseInterceptor(func) {
		this.axiosInstance.interceptors.response.use(func)
	}

	/**
	 * default interceptor for request
	 */
	addDefaultRequestInterceptor() {
		this.axiosInstance.interceptors.request.use((config) => {
			let need = Object.keys(this.option.auth).length > 0
			if (need) {
				const timestamp = Date.now()

				let query = {}
				const array = config.url.split('?')
				if (array.length > 1) {
					query = qs.parse(array[1])
				}
				const data = config.data || {}
				const params = config.params || {}

				// signature
				const signature = sign(
					Object.assign({
						__timestamp__: timestamp
					}, data, params, query),
					this.option.auth.token
				)

				// headers
				config.headers = {
					h_token: this.option.auth.token,
					h_nonce: this.option.auth.nonce,
					h_signature: signature,
					h_timestamp: timestamp
				}
			}

			return config
		}, (err) => {
			return Promise.reject(err)
		})
	}

	/**
	 * default interceptor for response
	 */
	addDefaultResponseInterceptor() {
		this.axiosInstance.interceptors.response.use((res) => {
			const data = res.data;
			if (data.status !== 200) {
				return Promise.reject({status: data.status, body: data.body, message: data.message})
			}
			return data.body
		}, (err) => {
			let errorMessage = err.message
			let status = -1
			if (err.response) {
				status = err.response.status
				switch (err.response.status) {
					case 404: {
						errorMessage = '404 not found'
						break
					}
					case 500: {
						errorMessage = '500 internal error'
						break
					}
				}
			}
			return Promise.reject({status: status, body: null, message: errorMessage})
		})
	}

	setRequestBaseURL(baseURL) {
		this.option.baseURL = baseURL
	}

	setRequestBasePath(basePath) {
		this.option.basePath = basePath
	}

	setRequestOption(option) {
		if (option.headers) {
			this.addRequestHeaders(option.headers)
			delete option.headers
		}
		Object.assign(this.option, option)
	}
	
	addRequestHeaders(headers = {}) {
		this.option.headers = Object.assign({}, this.option.headers, headers)
	}

	getRequestHeaders() {
		return this.option.headers
	}

	setRequestAuth(auth = {}) {
		if (!auth.token) {
			throw new Error('token required in auth')
		}
		if (!auth.nonce) {
			throw new Error('nonce required in auth')
		}
		this.option.auth = auth
	}

	raw(option) {
		return axios(option)
	}

	request(option) {
		option.url = `${this.option.baseURL}${this.option.basePath}${option.url}`
		return this.axiosInstance(option)
	}

	get(url, params = {}) {
		return this.request({method: 'get', url, params})
	}

	post(url, params = {}) {
		return this.request({method: 'post', url, data: params})
	}

	put(url, params = {}) {
		return this.request({method: 'put', url, data: params})
	}

	patch(url, params = {}) {
		return this.request({method: 'patch', url, data: params})
	}

	delete(url, params = {}) {
		return this.request({method: 'delete', url, data: params})
	}

	all(items) {
		if(!Array.isArray(items)) {
			if (typeof items !== 'object') {
				throw 'argument should be object or array.'
			}
			items = [items]
		}

		const task = []
		for(let item of items) {
			task.push(this.request(item))
		}
		return axios.all(task)
	}
}

export default new Fetch()