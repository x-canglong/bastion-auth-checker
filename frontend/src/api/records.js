import request from '@/utils/request'

/**
 * 获取授权记录列表
 */
export function getRecords(params) {
  return request({
    url: '/api/records/',
    method: 'get',
    params
  })
}

/**
 * 获取单个授权记录
 */
export function getRecord(id) {
  return request({
    url: `/api/records/${id}`,
    method: 'get'
  })
}

/**
 * 上传Excel文件
 */
export function uploadExcel(file) {
  const formData = new FormData()
  formData.append('file', file)
  return request({
    url: '/api/records/upload',
    method: 'post',
    data: formData,
    headers: {
      'Content-Type': 'multipart/form-data'
    },
    timeout: 60000 // 上传文件超时时间延长
  })
}

/**
 * 标记删除
 */
export function markDeletion(id, reason) {
  return request({
    url: `/api/records/${id}/mark-deletion`,
    method: 'put',
    params: { reason: reason }
  })
}

/**
 * 取消标记删除
 */
export function unmarkDeletion(id) {
  return request({
    url: `/api/records/${id}/unmark-deletion`,
    method: 'put'
  })
}

