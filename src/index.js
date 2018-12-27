import axios from 'axios'
import qs from 'query-string'
import md5 from 'blueimp-md5'

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
	headers: {}
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
			let need = Object.keys(this.option.extra).length > 0

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
						__url__: config.url,
						__timestamp__: timestamp
					}, data, params, query),
					this.option.extra.token
				)

				// headers
				config.headers = {
					h_token: this.option.extra.token,
					h_nonce: this.option.extra.nonce,
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
		this.option.headers = {
			...this.option.headers,
			headers
		}
	}

	getRequestHeaders() {
		return this.option.headers
	}

	setRequestExtra(extra = {}) {
		if (!extra.token) {
			throw new Error('token required in extra')
		}
		if (!extra.nonce) {
			throw new Error('nonce required in extra')
		}
		this.option.extra = extra
	}

	async raw(option) {
		return axios(option)
	}

	async request(option) {
		option.url = `${this.option.baseURL}${this.option.basePath}`
		return await this.axiosInstance(option)
	}

	async get(url, params = {}) {
		return this.request({method: 'get', url, params})
	}

	async post(url, params = {}) {
		return this.request({method: 'post', url, data: params})
	}

	async put(url, params = {}) {
		return this.request({method: 'put', url, data: params})
	}

	async patch(url, params = {}) {
		return this.request({method: 'patch', url, data: params})
	}

	async delete(url, params = {}) {
		return this.request({method: 'delete', url, data: params})
	}

	async all(items) {
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
		return await axios.all(task)
	}
}

module.exports = new Fetch()