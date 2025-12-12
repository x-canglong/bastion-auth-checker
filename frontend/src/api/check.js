import request from '@/utils/request'

/**
 * 执行检查
 */
export function executeCheck(checkTime = null) {
  return request({
    url: '/api/check/execute',
    method: 'post',
    data: { check_time: checkTime }
  })
}

/**
 * 获取检查历史
 */
export function getCheckHistory(params) {
  return request({
    url: '/api/check/history',
    method: 'get',
    params
  })
}

/**
 * 获取检查历史详情
 */
export function getCheckHistoryDetail(id) {
  return request({
    url: `/api/check/history/${id}`,
    method: 'get'
  })
}

