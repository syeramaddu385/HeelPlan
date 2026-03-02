import axios from 'axios'

const api = axios.create({ baseURL: 'http://localhost:8000' })

export const searchCourses = (q) =>
  api.get('/courses', { params: { q } }).then(r => r.data.courses)

export const fetchSections = (course) =>
  api.get('/sections', { params: { course } }).then(r => r.data.sections)

export const buildSchedule = (courses, preferences) =>
  api.post('/schedule', { courses, preferences }).then(r => r.data.schedules)
