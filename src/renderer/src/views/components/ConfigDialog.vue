<template>
  <el-dialog
    v-model="dialogVisible"
    title="规则配置"
    width="900px"
    :close-on-click-modal="false"
    destroy-on-close
  >
    <div class="config-dialog-content">
      <el-scrollbar height="600px">
        <!-- 运维人员配置 -->
        <el-card class="config-section-card" shadow="hover">
          <template #header>
            <div class="section-header">
              <el-icon class="section-icon"><User /></el-icon>
              <span class="section-title">运维岗位人员名单</span>
            </div>
          </template>
          <div class="section-content">
            <p class="section-desc">每行一个姓名，支持部分匹配。例如：从"张三已授权主机"中提取"张三"进行匹配。</p>
            <el-input
              v-model="localConfig.opsPersonnelText"
              type="textarea"
              :rows="6"
              placeholder="例如：&#10;王礼鑫&#10;王鹏辉&#10;杨志智&#10;张涛"
              class="config-textarea"
            />
            <div class="config-preview">
              <span class="preview-label">当前配置：</span>
              <el-tag
                v-for="(name, index) in getOpsPersonnelArray()"
                :key="index"
                type="success"
                size="small"
                class="preview-tag"
              >
                {{ name }}
              </el-tag>
              <span v-if="getOpsPersonnelArray().length === 0" class="preview-empty">暂无配置</span>
            </div>
          </div>
        </el-card>

        <!-- 生产环境主机规则 -->
        <el-card class="config-section-card" shadow="hover">
          <template #header>
            <div class="section-header">
              <el-icon class="section-icon"><Monitor /></el-icon>
              <span class="section-title">生产环境主机名称规则</span>
            </div>
          </template>
          <div class="section-content">
            <p class="section-desc">每行一个规则，支持正则表达式。主机名称匹配任一规则即视为生产环境。</p>
            <el-input
              v-model="localConfig.productionHostPatternsText"
              type="textarea"
              :rows="6"
              placeholder="例如：&#10;prd&#10;pehx-outpub-&#10;^prod-"
              class="config-textarea"
            />
            <div class="config-preview">
              <span class="preview-label">当前配置：</span>
              <el-tag
                v-for="(pattern, index) in getProductionHostPatternsArray()"
                :key="index"
                type="warning"
                size="small"
                class="preview-tag"
              >
                {{ pattern }}
              </el-tag>
              <span v-if="getProductionHostPatternsArray().length === 0" class="preview-empty">暂无配置</span>
            </div>
          </div>
        </el-card>

        <!-- 生产环境排除规则 -->
        <el-card class="config-section-card" shadow="hover">
          <template #header>
            <div class="section-header">
              <el-icon class="section-icon"><CircleClose /></el-icon>
              <span class="section-title">生产环境主机名称排除规则</span>
            </div>
          </template>
          <div class="section-content">
            <p class="section-desc">每行一个规则，匹配这些规则的主机不会被识别为生产环境。</p>
            <el-input
              v-model="localConfig.productionHostExcludePatternsText"
              type="textarea"
              :rows="4"
              placeholder="例如：&#10;uat&#10;test"
              class="config-textarea"
            />
            <div class="config-preview">
              <span class="preview-label">当前配置：</span>
              <el-tag
                v-for="(pattern, index) in getProductionHostExcludePatternsArray()"
                :key="index"
                type="info"
                size="small"
                class="preview-tag"
              >
                {{ pattern }}
              </el-tag>
              <span v-if="getProductionHostExcludePatternsArray().length === 0" class="preview-empty">暂无配置</span>
            </div>
          </div>
        </el-card>

        <!-- 重复授权配置 -->
        <el-card class="config-section-card" shadow="hover">
          <template #header>
            <div class="section-header">
              <el-icon class="section-icon"><CopyDocument /></el-icon>
              <span class="section-title">重复授权判断规则</span>
            </div>
          </template>
          <div class="section-content">
            <p class="section-desc">配置哪些字段都重复才算重复授权。默认：主机IP + 主机名称 + 主机网络 + 主机组 + 协议 + 账户登录名</p>
            <el-checkbox-group v-model="localConfig.duplicateFields" class="checkbox-group">
              <el-checkbox label="主机IP">主机IP</el-checkbox>
              <el-checkbox label="主机名称">主机名称</el-checkbox>
              <el-checkbox label="主机网络">主机网络</el-checkbox>
              <el-checkbox label="主机组">主机组</el-checkbox>
              <el-checkbox label="协议">协议</el-checkbox>
              <el-checkbox label="账户登录名">账户登录名</el-checkbox>
            </el-checkbox-group>
            <div class="config-preview">
              <span class="preview-label">当前配置：</span>
              <el-tag
                v-for="(field, index) in localConfig.duplicateFields"
                :key="index"
                type="info"
                size="small"
                class="preview-tag"
              >
                {{ field }}
              </el-tag>
              <span v-if="localConfig.duplicateFields.length === 0" class="preview-empty">请至少选择一个字段</span>
            </div>
          </div>
        </el-card>

        <!-- 主数据库IP配置 -->
        <el-card class="config-section-card" shadow="hover">
          <template #header>
            <div class="section-header">
              <el-icon class="section-icon"><Connection /></el-icon>
              <span class="section-title">主数据库IP地址配置</span>
            </div>
          </template>
          <div class="section-content">
            <div class="config-subsection">
              <p class="section-desc">主数据库IP地址列表（每行一个）：</p>
              <el-input
                v-model="localConfig.masterDbIPsText"
                type="textarea"
                :rows="5"
                placeholder="例如：&#10;192.168.240.181&#10;192.168.240.156"
                class="config-textarea"
              />
              <div class="config-preview">
                <span class="preview-label">当前配置：</span>
                <el-tag
                  v-for="(ip, index) in getMasterDbIPsArray()"
                  :key="index"
                  type="danger"
                  size="small"
                  class="preview-tag"
                >
                  {{ ip }}
                </el-tag>
                <span v-if="getMasterDbIPsArray().length === 0" class="preview-empty">暂无配置</span>
              </div>
            </div>
            <el-divider />
            <div class="config-subsection">
              <p class="section-desc">主数据库IP地址范围（用于范围判断）：</p>
              <div class="ip-range-inputs">
                <el-input
                  v-model="localConfig.masterDbIPRange.start"
                  placeholder="起始IP"
                  class="ip-input"
                >
                  <template #prepend>起始IP</template>
                </el-input>
                <span class="ip-range-separator">-</span>
                <el-input
                  v-model="localConfig.masterDbIPRange.end"
                  placeholder="结束IP"
                  class="ip-input"
                >
                  <template #prepend>结束IP</template>
                </el-input>
              </div>
              <div class="config-preview">
                <span class="preview-label">当前范围：</span>
                <el-tag v-if="isIPRangeValid()" type="success" size="small">
                  {{ localConfig.masterDbIPRange.start }} - {{ localConfig.masterDbIPRange.end }}
                </el-tag>
                <el-tag v-else type="info" size="small">未配置</el-tag>
              </div>
            </div>
          </div>
        </el-card>

        <!-- 长时间权限配置 -->
        <el-card class="config-section-card" shadow="hover">
          <template #header>
            <div class="section-header">
              <el-icon class="section-icon"><Clock /></el-icon>
              <span class="section-title">长时间权限判断</span>
            </div>
          </template>
          <div class="section-content">
            <p class="section-desc">非运维人员在生产环境的权限超过设定天数将被标记删除。与设定天数前的历史记录比较，只检查生产环境。</p>
            <div class="long-time-config">
              <el-input-number
                v-model="localConfig.longTimeDays"
                :min="1"
                :max="365"
                :precision="0"
                size="large"
                style="width: 200px"
              />
              <span class="unit-text">天</span>
            </div>
            <div class="config-preview">
              <span class="preview-label">当前配置：</span>
              <el-tag type="warning" size="small">
                超过 {{ localConfig.longTimeDays || 30 }} 天的生产环境权限将被标记删除
              </el-tag>
            </div>
          </div>
        </el-card>

        <!-- 历史文件数量限制配置 -->
        <el-card class="config-section-card" shadow="hover">
          <template #header>
            <div class="section-header">
              <el-icon class="section-icon"><Files /></el-icon>
              <span class="section-title">历史文件数量限制</span>
            </div>
          </template>
          <div class="section-content">
            <p class="section-desc">历史文件目录中最多保存的Excel文件数量，超出将删除最早的文件。</p>
            <div class="long-time-config">
              <el-input-number
                v-model="localConfig.maxHistoryFiles"
                :min="10"
                :max="200"
                :precision="0"
                size="large"
                style="width: 200px"
              />
              <span class="unit-text">个</span>
            </div>
            <div class="config-preview">
              <span class="preview-label">当前配置：</span>
              <el-tag type="info" size="small">
                最多保存 {{ localConfig.maxHistoryFiles || 50 }} 个历史文件
              </el-tag>
            </div>
          </div>
        </el-card>
      </el-scrollbar>
    </div>

    <template #footer>
      <div class="dialog-footer">
        <el-button :icon="Close" @click="handleCancel">取消</el-button>
        <el-button :icon="Upload" @click="handleImport">导入</el-button>
        <el-button :icon="Download" @click="handleExport">导出</el-button>
        <el-button :icon="DocumentAdd" type="primary" @click="handleSave">保存</el-button>
      </div>
    </template>
  </el-dialog>
</template>

<script setup>
import { ref, reactive, watch } from 'vue'
import { ElMessage } from 'element-plus'
import {
  User,
  Monitor,
  CircleClose,
  Connection,
  Refresh,
  DocumentAdd,
  Close,
  CopyDocument,
  Clock,
  Files,
  Upload,
  Download
} from '@element-plus/icons-vue'

const props = defineProps({
  modelValue: {
    type: Boolean,
    default: false
  },
  config: {
    type: Object,
    required: true
  }
})

const emit = defineEmits(['update:modelValue', 'save', 'load'])

const dialogVisible = ref(false)

const localConfig = reactive({
  opsPersonnelText: '',
  productionHostPatternsText: '',
  productionHostExcludePatternsText: '',
  masterDbIPsText: '',
  masterDbIPRange: {
    start: '',
    end: ''
  },
  duplicateFields: ['主机IP', '主机名称', '主机网络', '主机组', '协议', '账户登录名'],
  longTimeDays: 30,
  maxHistoryFiles: 50
})

watch(() => props.modelValue, (val) => {
  dialogVisible.value = val
  if (val) {
    loadConfigFromProps()
  }
})

// 监听 props.config 的变化，当配置更新时重新加载
watch(() => props.config, () => {
  if (dialogVisible.value) {
    loadConfigFromProps()
  }
}, { deep: true })

watch(dialogVisible, (val) => {
  emit('update:modelValue', val)
})

const loadConfigFromProps = () => {
  localConfig.opsPersonnelText = props.config.opsPersonnelText || ''
  localConfig.productionHostPatternsText = props.config.productionHostPatternsText || ''
  localConfig.productionHostExcludePatternsText = props.config.productionHostExcludePatternsText || ''
  localConfig.masterDbIPsText = props.config.masterDbIPsText || ''
  localConfig.masterDbIPRange = {
    start: props.config.masterDbIPRange?.start || '',
    end: props.config.masterDbIPRange?.end || ''
  }
  localConfig.duplicateFields = props.config.duplicateFields || ['主机IP', '主机名称', '主机网络', '主机组', '协议', '账户登录名']
  localConfig.longTimeDays = props.config.longTimeDays || 30
  localConfig.maxHistoryFiles = props.config.maxHistoryFiles || 50
}

const getConfigObject = () => {
  // 确保返回完全可序列化的对象
  return {
    opsPersonnel: Array.isArray(localConfig.opsPersonnelText.split('\n').filter(s => s.trim()))
      ? [...localConfig.opsPersonnelText.split('\n').filter(s => s.trim())]
      : [],
    productionHostPatterns: Array.isArray(localConfig.productionHostPatternsText.split('\n').filter(s => s.trim()))
      ? [...localConfig.productionHostPatternsText.split('\n').filter(s => s.trim())]
      : [],
    productionHostExcludePatterns: Array.isArray(localConfig.productionHostExcludePatternsText.split('\n').filter(s => s.trim()))
      ? [...localConfig.productionHostExcludePatternsText.split('\n').filter(s => s.trim())]
      : [],
    masterDbIPs: Array.isArray(localConfig.masterDbIPsText.split('\n').filter(s => s.trim()))
      ? [...localConfig.masterDbIPsText.split('\n').filter(s => s.trim())]
      : [],
    masterDbIPRange: {
      start: String(localConfig.masterDbIPRange.start || ''),
      end: String(localConfig.masterDbIPRange.end || '')
    },
    duplicateFields: Array.isArray(localConfig.duplicateFields)
      ? [...localConfig.duplicateFields]
      : ['主机IP', '主机名称', '主机网络', '主机组', '协议', '账户登录名'],
    longTimeDays: Number(localConfig.longTimeDays) || 30,
    maxHistoryFiles: Number(localConfig.maxHistoryFiles) || 50
  }
}

const getOpsPersonnelArray = () => {
  return localConfig.opsPersonnelText.split('\n').filter(s => s.trim())
}

const getProductionHostPatternsArray = () => {
  return localConfig.productionHostPatternsText.split('\n').filter(s => s.trim())
}

const getProductionHostExcludePatternsArray = () => {
  return localConfig.productionHostExcludePatternsText.split('\n').filter(s => s.trim())
}

const getMasterDbIPsArray = () => {
  return localConfig.masterDbIPsText.split('\n').filter(s => s.trim())
}

const isIPRangeValid = () => {
  return localConfig.masterDbIPRange.start && localConfig.masterDbIPRange.end
}

// 验证IP地址格式
const validateIP = (ip) => {
  if (!ip) return true // 空值允许
  const ipRegex = /^(\d{1,3}\.){3}\d{1,3}$/
  if (!ipRegex.test(ip)) return false
  const parts = ip.split('.')
  return parts.every(part => {
    const num = parseInt(part, 10)
    return num >= 0 && num <= 255
  })
}

// 验证正则表达式
const validateRegex = (pattern) => {
  if (!pattern) return true // 空值允许
  try {
    new RegExp(pattern)
    return true
  } catch (e) {
    return false
  }
}

// 验证配置
const validateConfig = () => {
  const errors = []

  // 验证主数据库IP列表
  const masterDbIPs = getMasterDbIPsArray()
  masterDbIPs.forEach((ip, index) => {
    if (!validateIP(ip)) {
      errors.push(`主数据库IP列表第${index + 1}行格式错误: ${ip}`)
    }
  })

  // 验证IP范围
  if (localConfig.masterDbIPRange.start && !validateIP(localConfig.masterDbIPRange.start)) {
    errors.push(`起始IP格式错误: ${localConfig.masterDbIPRange.start}`)
  }
  if (localConfig.masterDbIPRange.end && !validateIP(localConfig.masterDbIPRange.end)) {
    errors.push(`结束IP格式错误: ${localConfig.masterDbIPRange.end}`)
  }

  // 验证生产环境主机名称规则（正则表达式）
  const productionHostPatterns = getProductionHostPatternsArray()
  productionHostPatterns.forEach((pattern, index) => {
    if (!validateRegex(pattern)) {
      errors.push(`生产环境主机名称规则第${index + 1}行不是有效的正则表达式: ${pattern}`)
    }
  })

  // 验证排除规则
  const excludePatterns = getProductionHostExcludePatternsArray()
  excludePatterns.forEach((pattern, index) => {
    if (!validateRegex(pattern)) {
      errors.push(`排除规则第${index + 1}行不是有效的正则表达式: ${pattern}`)
    }
  })

  // 验证数字范围
  if (localConfig.longTimeDays < 1 || localConfig.longTimeDays > 365) {
    errors.push('长时间权限天数必须在1-365之间')
  }

  if (localConfig.maxHistoryFiles < 10 || localConfig.maxHistoryFiles > 200) {
    errors.push('历史文件数量限制必须在10-200之间')
  }

  // 验证重复授权字段
  if (!localConfig.duplicateFields || localConfig.duplicateFields.length === 0) {
    errors.push('至少需要选择一个重复授权判断字段')
  }

  return errors
}

const handleSave = async () => {
  // 验证配置
  const errors = validateConfig()
  if (errors.length > 0) {
    ElMessage.error('配置验证失败：\n' + errors.join('\n'))
    return
  }

  const configObj = getConfigObject()
  const result = await emit('save', configObj)
  if (result) {
    ElMessage.success('配置已保存')
    // 保存成功后，重新加载配置以确保显示最新值
    await handleLoad()
  }
  handleCancel()
}

const handleLoad = async () => {
  const result = await emit('load')
  if (result) {
    loadConfigFromProps()
  }
}

const handleCancel = () => {
  dialogVisible.value = false
}

const handleExport = async () => {
  if (!window.electron || !window.electron.ipcRenderer) {
    ElMessage.error('IPC未加载')
    return
  }

  try {
    const result = await window.electron.ipcRenderer.invoke('export-config')
    if (result.success) {
      ElMessage.success(`配置已导出到: ${result.filePath}`)
    } else {
      ElMessage.error('导出配置失败: ' + (result.error || '未知错误'))
    }
  } catch (err) {
    ElMessage.error('导出配置失败: ' + err.message)
  }
}

const handleImport = async () => {
  if (!window.electron || !window.electron.ipcRenderer) {
    ElMessage.error('IPC未加载')
    return
  }

  try {
    const result = await window.electron.ipcRenderer.invoke('import-config')
    if (result.success) {
      ElMessage.success('配置已导入，请重新加载')
      await handleLoad()
    } else {
      ElMessage.error('导入配置失败: ' + (result.error || '未知错误'))
    }
  } catch (err) {
    ElMessage.error('导入配置失败: ' + err.message)
  }
}
</script>

<style lang="stylus" scoped>
.config-dialog-content
  padding 10px 0

.config-section-card
  margin-bottom 20px
  border-radius 8px
  transition all 0.3s ease

  &:hover
    box-shadow 0 4px 12px rgba(0, 0, 0, 0.1)

  :deep(.el-card__header)
    background linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%)
    border-bottom 1px solid #e4e7ed
    padding 15px 20px

  :deep(.el-card__body)
    padding 20px

.section-header
  display flex
  align-items center
  gap 10px

  .section-icon
    font-size 20px
    color #667eea

  .section-title
    font-size 16px
    font-weight 600
    color #333

.section-content
  .section-desc
    margin 0 0 12px 0
    font-size 13px
    color #666
    line-height 1.6

  .config-textarea
    margin-bottom 12px

  .config-preview
    display flex
    flex-wrap wrap
    align-items center
    gap 8px
    padding 12px
    background #f8f9fa
    border-radius 6px

    .preview-label
      font-size 13px
      color #999
      margin-right 8px

    .preview-tag
      margin 0

    .preview-empty
      font-size 13px
      color #ccc
      font-style italic

.config-subsection
  margin-bottom 20px

  &:last-child
    margin-bottom 0

.ip-range-inputs
  display flex
  align-items center
  gap 12px
  margin-bottom 12px

  .ip-input
    flex 1

  .ip-range-separator
    font-size 18px
    color #999
    font-weight 600

.checkbox-group
  display flex
  flex-wrap wrap
  gap 15px
  margin-bottom 12px

.long-time-config
  display flex
  align-items center
  gap 10px
  margin-bottom 12px

  .unit-text
    font-size 14px
    color #666

.dialog-footer
  display flex
  justify-content flex-end
  gap 10px
</style>

