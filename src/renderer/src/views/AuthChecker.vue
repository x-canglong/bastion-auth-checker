<template>
  <div class="auth-checker-app">
    <!-- 顶部导航栏 -->
    <div class="app-header">
      <div class="header-content">
        <div class="logo-section">
          <el-icon class="logo-icon"><Lock /></el-icon>
          <div class="logo-text">
            <h1>堡垒机授权检查工具</h1>
            <p class="subtitle">自动检查并标记不符合常规逻辑的授权项目</p>
          </div>
        </div>
        <div class="header-actions">
          <el-button type="info" :icon="Folder" @click="openHistoryManager">
            历史文件
          </el-button>
          <el-button type="warning" :icon="Document" @click="openLogManager">
            日志管理
          </el-button>
          <el-button type="success" :icon="Refresh" @click="openUpdateDialog">
            检查更新
          </el-button>
          <el-button type="primary" :icon="Setting" @click="openConfigDialog">
            规则配置
          </el-button>
        </div>
      </div>
    </div>

    <!-- 主内容区 -->
    <div class="app-content">
      <!-- 文件选择卡片 -->
      <el-card class="file-card" shadow="hover">
        <template #header>
          <div class="card-header">
            <span class="card-title">
              <el-icon><FolderOpened /></el-icon>
              文件选择
            </span>
          </div>
        </template>
        <div class="file-section">
          <div class="file-info-wrapper">
            <div class="file-info">
              <el-icon class="file-icon"><Document /></el-icon>
              <div class="file-details">
                <div class="file-name">{{ selectedFile ? getFileName(selectedFile) : '未选择文件' }}</div>
                <div class="file-path" v-if="selectedFile">{{ selectedFile }}</div>
              </div>
            </div>
            <div class="action-buttons">
              <el-button type="primary" :icon="FolderOpened" @click="selectFile" size="large">
                选择Excel文件
              </el-button>
              <div style="display: flex; align-items: center; gap: 10px;">
                <el-button
                  type="success"
                  :icon="Search"
                  @click="processFile"
                  :disabled="!selectedFile || processing"
                  :loading="processing"
                  size="large"
                >
                  {{ processing ? (progressMessage || '检查中...') : '开始检查' }}
                </el-button>
                <el-progress
                  v-if="processing"
                  :percentage="progressPercentage"
                  :status="progressPercentage === 100 ? 'success' : undefined"
                  :stroke-width="6"
                  style="width: 200px"
                />
              </div>
              <el-button
                type="success"
                :icon="Download"
                @click="saveResult"
                :disabled="!result || !cacheKey"
                size="large"
              >
                导出Excel
              </el-button>
            </div>
          </div>
        </div>
      </el-card>

      <!-- 检查结果 -->
      <div v-if="result && !processing" class="result-section">
        <!-- 统计信息卡片 -->
        <el-card class="summary-card" shadow="hover">
          <template #header>
            <div class="card-header">
              <span class="card-title">
                <el-icon><DataAnalysis /></el-icon>
                检查统计
              </span>
            </div>
          </template>
          <div class="summary-grid">
            <div class="summary-item">
              <div class="summary-icon total">
                <el-icon><Files /></el-icon>
              </div>
              <div class="summary-content">
                <div class="summary-label">总工作表数</div>
                <div class="summary-value">{{ result.summary.totalSheets }}</div>
              </div>
            </div>
            <div class="summary-item">
              <div class="summary-icon records">
                <el-icon><Document /></el-icon>
              </div>
              <div class="summary-content">
                <div class="summary-label">总记录数</div>
                <div class="summary-value">{{ result.summary.totalRecords }}</div>
              </div>
            </div>
            <div class="summary-item highlight">
              <div class="summary-icon danger">
                <el-icon><Warning /></el-icon>
              </div>
              <div class="summary-content">
                <div class="summary-label">标记删除数</div>
                <div class="summary-value danger-text">{{ result.summary.markedForDeletion }}</div>
              </div>
            </div>
            <div class="summary-item">
              <div class="summary-icon success">
                <el-icon><CircleCheck /></el-icon>
              </div>
              <div class="summary-content">
                <div class="summary-label">正常记录数</div>
                <div class="summary-value success-text">
                  {{ result.summary.totalRecords - result.summary.markedForDeletion }}
                </div>
              </div>
            </div>
          </div>

          <!-- 删除原因统计 -->
          <div v-if="Object.keys(result.summary.byReason).length > 0" class="reason-breakdown">
            <h3 class="breakdown-title">
              <el-icon><List /></el-icon>
              删除原因统计
            </h3>
            <div class="reason-tags">
              <el-tag
                v-for="(count, reason) in result.summary.byReason"
                :key="reason"
                type="danger"
                size="large"
                class="reason-tag"
              >
                {{ reason }}: {{ count }} 条
              </el-tag>
            </div>
          </div>
        </el-card>

        <!-- 预览卡片 -->
        <el-card class="preview-card" shadow="hover">
          <template #header>
            <div class="card-header">
              <span class="card-title">
                <el-icon><View /></el-icon>
                检查预览
              </span>
              <div class="preview-controls">
                <el-radio-group v-model="previewFilter" size="default">
                  <el-radio-button label="all">
                    <el-icon><List /></el-icon>
                    全部记录
                  </el-radio-button>
                  <el-radio-button label="marked">
                    <el-icon><Warning /></el-icon>
                    仅标记删除
                  </el-radio-button>
                </el-radio-group>
              </div>
            </div>
          </template>

          <!-- 工作表Tabs -->
          <el-tabs v-model="activeSheetTab" type="border-card" v-if="result.preview && Object.keys(result.preview).length > 0">
            <el-tab-pane
              v-for="(records, sheetName) in result.preview"
              :key="sheetName"
              :label="`${sheetName} (${getFilteredRecords(records).length}/${records.length})`"
              :name="sheetName"
            >
              <!-- Tabs内容为空 -->
            </el-tab-pane>
          </el-tabs>
          <div class="table-container" v-loading="updating">
            <el-table-v2
              :columns="tableColumns"
              :data="currentTableData"
              :width="1400"
              :height="600"
              fixed
              :row-class="getRowClassName"
            />
          </div>
          <!-- <div v-else class="empty-preview">
            <el-empty description="暂无记录" />
          </div> -->
        </el-card>
      </div>

      <!-- 错误提示 -->
      <el-alert
        v-if="error"
        :title="error"
        type="error"
        :closable="true"
        @close="error = ''"
        show-icon
        class="error-alert"
      />
    </div>

    <!-- 规则配置对话框 -->
    <ConfigDialog
      v-model="configDialogVisible"
      :config="config"
      @save="handleConfigSave"
      @load="handleConfigLoad"
    />

    <!-- 更新对话框 -->
    <UpdateDialog
      ref="updateDialogRef"
      v-model="updateDialogVisible"
    />

    <!-- 历史文件管理对话框 -->
    <HistoryManager v-model="historyManagerVisible" />
  </div>
</template>

<script setup>
import { ref, reactive, onMounted, computed, h } from 'vue'
import { ElMessage } from 'element-plus'
import { ElTag, ElSwitch } from 'element-plus'

const emit = defineEmits(['open-history-manager', 'open-log-manager'])
import {
  Lock,
  Setting,
  FolderOpened,
  Document,
  Search,
  DataAnalysis,
  Files,
  Warning,
  CircleCheck,
  List,
  View,
  Download,
  Folder,
  Refresh
} from '@element-plus/icons-vue'
import ConfigDialog from './components/ConfigDialog.vue'
import UpdateDialog from './components/UpdateDialog.vue'

const selectedFile = ref('')
const processing = ref(false)
const updating = ref(false)
const result = ref(null)
const error = ref('')
const configDialogVisible = ref(false)
const updateDialogVisible = ref(false)
const updateDialogRef = ref(null)
const activeSheetTab = ref('')
const cacheKey = ref('')
const previewFilter = ref('marked')
const progressMessage = ref('')
const progressPercentage = ref(0)

const config = reactive({
  opsPersonnelText: '王礼鑫\n王鹏辉\n杨志智\n张涛',
  productionHostPatternsText: 'prd\npehx-outpub-',
  productionHostExcludePatternsText: 'uat',
  masterDbIPsText: '192.168.240.181\n192.168.240.156',
  masterDbIPRange: {
    start: '192.168.240.150',
    end: '192.168.240.190'
  },
  duplicateFields: ['主机IP', '主机名称', '主机网络', '主机组', '协议', '账户登录名'],
  longTimeDays: 30,
  maxHistoryFiles: 50
})

const getFileName = (filePath) => {
  return filePath.split(/[/\\]/).pop()
}

const getConfigObject = () => {
  // 确保返回完全可序列化的对象
  return {
    opsPersonnel: Array.isArray(config.opsPersonnelText.split('\n').filter(s => s.trim()))
      ? [...config.opsPersonnelText.split('\n').filter(s => s.trim())]
      : [],
    productionHostPatterns: Array.isArray(config.productionHostPatternsText.split('\n').filter(s => s.trim()))
      ? [...config.productionHostPatternsText.split('\n').filter(s => s.trim())]
      : [],
    productionHostExcludePatterns: Array.isArray(config.productionHostExcludePatternsText.split('\n').filter(s => s.trim()))
      ? [...config.productionHostExcludePatternsText.split('\n').filter(s => s.trim())]
      : [],
    masterDbIPs: Array.isArray(config.masterDbIPsText.split('\n').filter(s => s.trim()))
      ? [...config.masterDbIPsText.split('\n').filter(s => s.trim())]
      : [],
    masterDbIPRange: {
      start: String(config.masterDbIPRange.start || ''),
      end: String(config.masterDbIPRange.end || '')
    },
    duplicateFields: Array.isArray(config.duplicateFields)
      ? [...config.duplicateFields]
      : ['主机IP', '主机名称', '主机网络', '主机组', '协议', '账户登录名'],
    longTimeDays: Number(config.longTimeDays) || 30,
    maxHistoryFiles: Number(config.maxHistoryFiles) || 50
  }
}

const checkIPC = () => {
  if (!window.electron || !window.electron.ipcRenderer) {
    error.value = 'IPC未加载，请刷新页面重试'
    return false
  }
  return true
}

const openConfigDialog = () => {
  configDialogVisible.value = true
}

const openHistoryManager = () => {
  emit('open-history-manager')
}

const openLogManager = () => {
  emit('open-log-manager')
}

const openUpdateDialog = () => {
  updateDialogVisible.value = true
  // 延迟一下确保对话框已挂载
  setTimeout(() => {
    if (updateDialogRef.value && updateDialogRef.value.checkForUpdates) {
      updateDialogRef.value.checkForUpdates()
    }
  }, 100)
}

const handleConfigSave = async (configObj) => {
  if (!checkIPC()) return false

  try {
    // 确保配置对象完全可序列化
    const serializableConfig = {
      opsPersonnel: Array.isArray(configObj.opsPersonnel) ? [...configObj.opsPersonnel] : [],
      productionHostPatterns: Array.isArray(configObj.productionHostPatterns) ? [...configObj.productionHostPatterns] : [],
      productionHostExcludePatterns: Array.isArray(configObj.productionHostExcludePatterns) ? [...configObj.productionHostExcludePatterns] : [],
      masterDbIPs: Array.isArray(configObj.masterDbIPs) ? [...configObj.masterDbIPs] : [],
      masterDbIPRange: {
        start: String(configObj.masterDbIPRange?.start || ''),
        end: String(configObj.masterDbIPRange?.end || '')
      },
      duplicateFields: Array.isArray(configObj.duplicateFields) ? [...configObj.duplicateFields] : ['主机IP', '主机名称', '主机网络', '主机组', '协议', '账户登录名'],
      longTimeDays: Number(configObj.longTimeDays) || 30
    }

    const saveResult = await window.electron.ipcRenderer.invoke('save-config', serializableConfig)
    if (saveResult.success) {
      // 保存成功后，更新本地config对象
      config.opsPersonnelText = serializableConfig.opsPersonnel.join('\n')
      config.productionHostPatternsText = serializableConfig.productionHostPatterns.join('\n')
      config.productionHostExcludePatternsText = serializableConfig.productionHostExcludePatterns.join('\n')
      config.masterDbIPsText = serializableConfig.masterDbIPs.join('\n')
      config.masterDbIPRange = {
        start: serializableConfig.masterDbIPRange.start,
        end: serializableConfig.masterDbIPRange.end
      }
      config.duplicateFields = [...serializableConfig.duplicateFields]
      config.longTimeDays = serializableConfig.longTimeDays

      ElMessage.success('配置已保存')
      return true
    } else {
      error.value = '保存配置失败: ' + saveResult.error
      ElMessage.error('保存配置失败: ' + saveResult.error)
      return false
    }
  } catch (err) {
    error.value = '保存配置失败: ' + err.message
    ElMessage.error('保存配置失败: ' + err.message)
    return false
  }
}

const handleConfigLoad = async () => {
  if (!checkIPC()) return null

  try {
    const savedConfig = await window.electron.ipcRenderer.invoke('load-config')
    config.opsPersonnelText = savedConfig.opsPersonnel.join('\n')
    config.productionHostPatternsText = savedConfig.productionHostPatterns.join('\n')
    config.productionHostExcludePatternsText = (savedConfig.productionHostExcludePatterns || []).join('\n')
    config.masterDbIPsText = savedConfig.masterDbIPs.join('\n')
    config.masterDbIPRange = savedConfig.masterDbIPRange || config.masterDbIPRange
    config.duplicateFields = savedConfig.duplicateFields || ['主机IP', '主机名称', '主机网络', '主机组', '协议', '账户登录名']
    config.longTimeDays = savedConfig.longTimeDays || 30
    config.maxHistoryFiles = savedConfig.maxHistoryFiles || 50
    ElMessage.success('配置已加载')
    return savedConfig
  } catch (err) {
    error.value = '加载配置失败: ' + err.message
    ElMessage.error('加载配置失败: ' + err.message)
    return null
  }
}

const selectFile = async () => {
  if (!checkIPC()) return

  try {
    const filePath = await window.electron.ipcRenderer.invoke('select-excel-file')
    if (filePath) {
      selectedFile.value = filePath
      result.value = null
      error.value = ''
      cacheKey.value = ''
    }
  } catch (err) {
    error.value = '选择文件失败: ' + err.message
    ElMessage.error('选择文件失败: ' + err.message)
  }
}

const processFile = async () => {
  if (!checkIPC()) return
  if (!selectedFile.value) return

  processing.value = true
  error.value = ''
  progressMessage.value = '准备开始...'
  progressPercentage.value = 0

  // 监听进度事件
  const progressHandler = (event, progress) => {
    progressMessage.value = progress.message || '处理中...'
    const stageProgress = {
      'start': 10,
      'history': 30,
      'history-error': 30,
      'processing': 60,
      'preview': 80,
      'saving': 95,
      'complete': 100
    }
    progressPercentage.value = stageProgress[progress.stage] || 0
  }

  window.electron.ipcRenderer.on('process-progress', progressHandler)

  try {
    const configObj = getConfigObject()
    const processResult = await window.electron.ipcRenderer.invoke('process-excel', selectedFile.value, configObj)

    progressMessage.value = '处理完成'
    progressPercentage.value = 100

    if (!processResult) {
      throw new Error('未收到处理结果，请检查控制台错误信息')
    }

    if (processResult.success) {
      result.value = processResult
      cacheKey.value = processResult.cacheKey
      if (processResult.preview && Object.keys(processResult.preview).length > 0) {
        const firstSheet = Object.keys(processResult.preview)[0]
        activeSheetTab.value = firstSheet
      }
      ElMessage.success('检查完成')
    } else {
      const errorMsg = processResult.error || '处理失败'
      error.value = errorMsg
      ElMessage.error(errorMsg)
    }
  } catch (err) {
    const errorMsg = '处理文件失败: ' + (err.message || String(err))
    error.value = errorMsg
    ElMessage.error(errorMsg)
    progressMessage.value = '处理失败'
  } finally {
    window.electron.ipcRenderer.removeListener('process-progress', progressHandler)
    processing.value = false
    setTimeout(() => {
      progressMessage.value = ''
      progressPercentage.value = 0
    }, 2000)
  }
}

const handleDeleteMarkChange = async (row) => {
  if (!checkIPC() || !cacheKey.value) return

  updating.value = true
  try {
    const updateResult = await window.electron.ipcRenderer.invoke(
      'update-delete-mark',
      cacheKey.value,
      row.sheetName,
      row.originalIndex,
      row.shouldDelete
    )

    if (updateResult.success) {
      result.value.summary = updateResult.summary
      result.value.preview = updateResult.preview
      row['删除标记'] = row.shouldDelete ? '删除' : ''
    } else {
      ElMessage.error(updateResult.error || '更新失败')
      row.shouldDelete = !row.shouldDelete
    }
  } catch (err) {
    ElMessage.error('更新删除标记失败: ' + err.message)
    row.shouldDelete = !row.shouldDelete
  } finally {
    updating.value = false
  }
}

const getFilteredRecords = (records) => {
  if (previewFilter.value === 'all') {
    return records
  } else {
    return records.filter(r => r.shouldDelete)
  }
}

// 当前表格数据
const currentTableData = computed(() => {
  if (!result.value || !result.value.preview || !activeSheetTab.value) {
    return []
  }
  const records = result.value.preview[activeSheetTab.value] || []
  return getFilteredRecords(records)
})

// 表格列配置
const tableColumns = computed(() => {
  return [
    {
      key: '主机IP',
      dataKey: '主机IP',
      title: '主机IP',
      width: 150,
      fixed: 'left'
    },
    {
      key: '主机名称',
      dataKey: '主机名称',
      title: '主机名称',
      width: 200,
      cellRenderer: ({ rowData }) => {
        return h('div', {
          style: { padding: '8px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
          title: rowData['主机名称']
        }, rowData['主机名称'] || '-')
      }
    },
    {
      key: '主机网络',
      dataKey: '主机网络',
      title: '主机网络',
      width: 180,
      cellRenderer: ({ rowData }) => {
        return h('div', {
          style: { padding: '8px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
          title: rowData['主机网络']
        }, rowData['主机网络'] || '-')
      }
    },
    {
      key: '主机组',
      dataKey: '主机组',
      title: '主机组',
      width: 180,
      cellRenderer: ({ rowData }) => {
        return h('div', {
          style: { padding: '8px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
          title: rowData['主机组']
        }, rowData['主机组'] || '-')
      }
    },
    {
      key: '协议',
      dataKey: '协议',
      title: '协议',
      width: 100,
      cellRenderer: ({ rowData }) => {
        if (!rowData['协议']) return h('span', '-')
        return h(ElTag, {
          type: getProtocolTag(rowData['协议']),
          size: 'small'
        }, () => rowData['协议'])
      }
    },
    {
      key: '账户登录名',
      dataKey: '账户登录名',
      title: '账户登录名',
      width: 150
    },
    {
      key: '删除原因',
      dataKey: '删除原因',
      title: '删除原因',
      width: 250,
      cellRenderer: ({ rowData }) => {
        if (!rowData['删除原因']) {
          return h('span', { style: { color: '#999', fontStyle: 'italic' } }, '-')
        }
        return h(ElTag, {
          type: 'danger',
          size: 'small'
        }, () => rowData['删除原因'])
      }
    },
    {
      key: '删除标记',
      dataKey: 'shouldDelete',
      title: '删除标记',
      width: 140,
      fixed: 'right',
      cellRenderer: ({ rowData }) => {
        return h(ElSwitch, {
          modelValue: rowData.shouldDelete,
          'onUpdate:modelValue': (val) => {
            rowData.shouldDelete = val
            handleDeleteMarkChange(rowData)
          },
          activeText: '删除',
          inactiveText: '保留',
          activeColor: '#f56c6c'
        })
      }
    }
  ]
})

const getRowClassName = ({ rowIndex }) => {
  const row = currentTableData.value[rowIndex]
  return row && row.shouldDelete ? 'marked-row' : ''
}

const getProtocolTag = (protocol) => {
  const map = {
    SSH: 'success',
    RDP: 'warning',
    MySQL: 'danger',
    MYSQL: 'danger'
  }
  return map[protocol?.toUpperCase()] || 'info'
}

const saveResult = async () => {
  if (!checkIPC()) return
  if (!selectedFile.value || !result.value || !cacheKey.value) return

  try {
    const defaultPath = selectedFile.value.replace(/\.xlsx?$/, '_检查结果.xlsx')
    const outputPath = await window.electron.ipcRenderer.invoke('save-excel-file', defaultPath)

    if (outputPath) {
      const saveResult = await window.electron.ipcRenderer.invoke(
        'save-processed-excel',
        cacheKey.value,
        outputPath
      )

      if (saveResult.success) {
        ElMessage.success(`文件已保存到: ${saveResult.filePath}`)
      } else {
        error.value = '保存文件失败: ' + saveResult.error
        ElMessage.error('保存文件失败: ' + saveResult.error)
      }
    }
  } catch (err) {
    error.value = '保存文件失败: ' + err.message
    ElMessage.error('保存文件失败: ' + err.message)
  }
}

onMounted(() => {
  setTimeout(() => {
    if (window.electron && window.electron.ipcRenderer) {
      handleConfigLoad()
    } else {
      error.value = 'IPC未加载，请刷新页面重试'
    }
  }, 100)
})
</script>

<style lang="stylus" scoped>
.auth-checker-app
  width 100vw
  height 100vh
  overflow-y auto
  background linear-gradient(135deg, #667eea 0%, #764ba2 100%)
  display flex
  flex-direction column

.app-header
  background rgba(255, 255, 255, 0.95)
  backdrop-filter blur(10px)
  box-shadow 0 2px 12px rgba(0, 0, 0, 0.1)
  padding 0
  z-index 1000

  .header-content
    max-width 1600px
    margin 0 auto
    padding 20px 30px
    display flex
    justify-content space-between
    align-items center

    .logo-section
      display flex
      align-items center
      gap 15px

      .logo-icon
        font-size 32px
        color #667eea

      .logo-text
        h1
          margin 0
          font-size 24px
          font-weight 600
          color #333
          background linear-gradient(135deg, #667eea 0%, #764ba2 100%)
          -webkit-background-clip text
          -webkit-text-fill-color transparent
          background-clip text

        .subtitle
          margin 5px 0 0 0
          font-size 13px
          color #999

.app-content
  flex 1
  max-width 1600px
  width 100%
  margin 0 auto
  padding 30px
  overflow-y auto

.file-card, .summary-card, .preview-card
  margin-bottom 24px
  border-radius 12px
  overflow hidden
  transition all 0.3s ease

  &:hover
    transform translateY(-2px)
    box-shadow 0 8px 24px rgba(0, 0, 0, 0.12)

  :deep(.el-card__header)
    background linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%)
    border-bottom 1px solid #e4e7ed
    padding 18px 24px

  :deep(.el-card__body)
    padding 24px

.card-header
  display flex
  justify-content space-between
  align-items center

  .card-title
    display flex
    align-items center
    gap 8px
    font-size 16px
    font-weight 600
    color #333

.file-section
  .file-info-wrapper
    display flex
    justify-content space-between
    align-items center
    gap 20px

    .file-info
      flex 1
      display flex
      align-items center
      gap 15px
      padding 20px
      background #f8f9fa
      border-radius 8px
      border 2px dashed #d9d9d9
      transition all 0.3s ease

      &:hover
        border-color #667eea
        background #f0f4ff

      .file-icon
        font-size 32px
        color #667eea

      .file-details
        flex 1
        min-width 0

        .file-name
          font-size 16px
          font-weight 500
          color #333
          margin-bottom 5px
          word-break break-all

        .file-path
          font-size 12px
          color #999
          word-break break-all

    .action-buttons
      display flex
      gap 12px

.summary-grid
  display grid
  grid-template-columns repeat(auto-fit, minmax(200px, 1fr))
  gap 20px
  margin-bottom 24px

  .summary-item
    display flex
    align-items center
    gap 15px
    padding 20px
    background #fff
    border-radius 8px
    border 1px solid #e4e7ed
    transition all 0.3s ease

    &:hover
      border-color #667eea
      box-shadow 0 4px 12px rgba(102, 126, 234, 0.15)

    &.highlight
      border-color #f56c6c
      background linear-gradient(135deg, #fff5f5 0%, #ffe7e7 100%)

    .summary-icon
      width 48px
      height 48px
      border-radius 12px
      display flex
      align-items center
      justify-content center
      font-size 24px
      color #fff

      &.total
        background linear-gradient(135deg, #667eea 0%, #764ba2 100%)

      &.records
        background linear-gradient(135deg, #f093fb 0%, #f5576c 100%)

      &.danger
        background linear-gradient(135deg, #fa709a 0%, #fee140 100%)

      &.success
        background linear-gradient(135deg, #30cfd0 0%, #330867 100%)

    .summary-content
      flex 1

      .summary-label
        font-size 13px
        color #999
        margin-bottom 5px

      .summary-value
        font-size 28px
        font-weight 700
        color #333

        &.danger-text
          color #f56c6c

        &.success-text
          color #67c23a

.reason-breakdown
  padding 20px
  background #fff
  border-radius 8px
  border 1px solid #e4e7ed

  .breakdown-title
    display flex
    align-items center
    gap 8px
    margin 0 0 15px 0
    font-size 16px
    font-weight 600
    color #333

  .reason-tags
    display flex
    flex-wrap wrap
    gap 10px

    .reason-tag
      font-size 14px
      padding 8px 16px

.preview-card
  .preview-controls
    display flex
    gap 10px

  :deep(.el-tabs__content)
    padding 0
    min-height 0

.empty-preview
  padding 60px 20px
  text-align center

.table-card
  margin-top 24px
  border-radius 12px
  overflow hidden

  :deep(.el-card__header)
    background linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%)
    border-bottom 1px solid #e4e7ed
    padding 18px 24px

  .card-header
    display flex
    justify-content space-between
    align-items center

    .table-info
      font-size 14px
      color #666

  .table-container
    padding 10px
    background #fff

    :deep(.el-table-v2)
      border 1px solid #e4e7ed
      border-radius 4px

    :deep(.marked-row)
      background-color #fff1f0 !important

    :deep(.marked-row:hover)
      background-color #ffe7e6 !important

.save-section
  text-align center
  padding 30px
  background #fff
  border-radius 12px
  box-shadow 0 2px 12px rgba(0, 0, 0, 0.1)

.error-alert
  margin-top 20px
  border-radius 8px

.text-muted
  color #999
  font-style italic
</style>
