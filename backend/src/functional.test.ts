import request from 'supertest'
import mongoose from 'mongoose'

import app from './app'
import config, { getMongoUri } from './config'
import { Thread } from './models/thread.model'
import { Reply } from './models/reply.model'

function isToday(date: string) {
  const today = new Date().toLocaleDateString()
  const testDate = new Date(date).toLocaleDateString()
  return today === testDate
}

describe('Functional Tests', () => {
  let testThread: any

  beforeAll(async () => {
    const url = getMongoUri('functional-tests')
    await mongoose.connect(url, config.mongoose.options)

    // create testing thread
    const { body } = await request(app).post('/api/threads/board-test').send({
      text: 'Thread test text for replies keep',
      password: 's3cr3t',
    })
    testThread = body
  })

  afterAll(async () => {
    // Delete all Threads except text contain "keep" word
    // const regex = new RegExp(/^(.(?!(keep)))*$/)
    await Thread.deleteMany({})
    await Reply.deleteMany({})
  })

  describe('API ROUTING FOR /api/threads/:board', () => {
    describe('POST', () => {
      test('should works with text & password', async done => {
        const res = await request(app).post('/api/threads/board-test').send({
          text: 'Thread test text',
          password: 's3cr3t',
        })

        expect(res.status).toEqual(201)
        expect(res.body.text).toEqual('Thread test text')
        expect(res.body.password).toEqual('s3cr3t')
        expect(res.body).toHaveProperty('_id')
        expect(res.body).toHaveProperty('createdAt')
        expect(res.body).toHaveProperty('bumpedAt')
        expect(res.body.reported).toBeFalsy()
        expect(Array.isArray(res.body.replies)).toBe(true)
        expect(res.body.replies).toBeArray()
        done()
      })

      test('should return an error if text missing', async done => {
        const res = await request(app).post('/api/threads/board-test').send({
          password: 's3cr3t',
        })

        expect(res.status).toEqual(200)
        expect(res.body.errors.text.properties.message).toEqual(
          'Path `text` is required.',
        )
        done()
      })

      test('should return an error if password missing', async done => {
        const res = await request(app).post('/api/threads/board-test').send({
          text: 'Thread test text',
        })

        expect(res.status).toEqual(200)
        expect(res.body.errors.password.properties.message).toEqual(
          'Path `password` is required.',
        )
        done()
      })
    })

    // describe('GET', () => {})

    // describe('DELETE', () => {})

    // describe('PUT', () => {})
  })

  describe('API ROUTING FOR /api/replies/:board', () => {
    describe('POST', () => {
      test('should throw error if text is missing', async done => {
        const res = await request(app).post('/api/replies/board-test').send({
          password: 's3cr3t',
          threadId: testThread._id,
        })

        expect(res.status).toEqual(200)
        expect(res.body.errors.text.properties.message).toEqual(
          'Path `text` is required.',
        )
        done()
      })

      test('should throw error if password is missing', async done => {
        const res = await request(app).post('/api/replies/board-test').send({
          text: 'reply text',
          threadId: testThread._id,
        })

        expect(res.status).toEqual(200)
        expect(res.body.errors.password.properties.message).toEqual(
          'Path `password` is required.',
        )
        done()
      })

      test('should throw error if threadId is missing', async done => {
        const res = await request(app).post('/api/replies/board-test').send({
          text: 'reply text houhou',
          password: 's3cr3t',
        })

        expect(res.body.message).toEqual('Thread id is missing')
        done()
      })

      test('should throw error if threadId un-exists', async done => {
        const fakeId = `0f01cbab2ab94d1650a062b3`
        const res = await request(app).post('/api/replies/board-test').send({
          text: 'reply text houhou',
          password: 's3cr3t',
          threadId: fakeId,
        })

        expect(res.body.message).toEqual('Thread does not exist')
        done()
      })

      test('should works with text, password & existing threadId', async done => {
        const res = await request(app).post('/api/replies/board-test').send({
          text: 'reply text',
          password: 's3cr3t',
          threadId: testThread._id,
        })

        const firstReply = res.body.replies[0]

        expect(res.status).toEqual(201)

        // it will also update the bumped_on date to the comments date
        expect(isToday(res.body.bumpedAt)).toBeTruthy()

        // In the thread's replies array will be saved
        expect(res.body.replies).toBeArrayOfSize(1)
        expect(firstReply).toHaveProperty('_id')
        expect(firstReply).toHaveProperty('createdAt')
        expect(firstReply.text).toEqual('reply text')
        expect(firstReply.password).toEqual('s3cr3t')
        expect(firstReply.reported).toBeFalsy()

        done()
      })
    })

    //     describe('GET', () => {})

    //     describe('PUT', () => {})

    //     describe('DELETE', () => {})
  })
})
