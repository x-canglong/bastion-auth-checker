import request from '@/utils/request'

/**
 * 获取规则列表
 */
export function getRules(ruleType = null) {
  return request({
    url: '/api/rules/',
    method: 'get',
    params: { rule_type: ruleType }
  })
}

/**
 * 获取单个规则
 */
export function getRule(id) {
  return request({
    url: `/api/rules/${id}`,
    method: 'get'
  })
}

/**
 * 创建规则
 */
export function createRule(data) {
  return request({
    url: '/api/rules/',
    method: 'post',
    data
  })
}

/**
 * 更新规则
 */
export function updateRule(id, data) {
  return request({
    url: `/api/rules/${id}`,
    method: 'put',
    data
  })
}

/**
 * 删除规则
 */
export function deleteRule(id) {
  return request({
    url: `/api/rules/${id}`,
    method: 'delete'
  })
}

