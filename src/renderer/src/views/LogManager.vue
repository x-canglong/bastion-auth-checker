<template>
  <div class="log-manager-page">
    <!-- 顶部导航栏 -->
    <div class="page-header">
      <div class="header-content">
        <div class="logo-section">
          <el-icon class="logo-icon"><Document /></el-icon>
          <div class="logo-text">
            <h1>日志管理</h1>
            <p class="subtitle">查看和管理应用运行日志</p>
          </div>
        </div>
        <div class="header-actions">
          <el-button type="primary" :icon="Refresh" @click="loadLogFiles" :loading="loading">
            刷新
          </el-button>
          <el-button type="danger" :icon="Delete" @click="cleanupLogFiles" :loading="cleaning">
            清理旧日志
          </el-button>
          <el-button type="info" :icon="Back" @click="goBack">
            返回
          </el-button>
        </div>
      </div>
    </div>

    <!-- 主内容区 -->
    <div class="page-content">
      <el-row :gutter="20">
        <!-- 左侧：日志文件列表 -->
        <el-col :span="6">
          <el-card shadow="hover">
            <template #header>
              <div class="card-header">
                <span class="card-title">
                  <el-icon><Files /></el-icon>
                  日志文件
                </span>
                <div class="file-count">
                  {{ logFiles.length }} 个文件
                </div>
              </div>
            </template>

            <el-scrollbar height="600px">
              <el-menu
                :default-active="selectedLogFile"
                @select="handleSelectLogFile"
                class="log-file-menu"
              >
                <el-menu-item
                  v-for="file in logFiles"
                  :key="file.filePath"
                  :index="file.filePath"
                >
                  <el-icon><Document /></el-icon>
                  <span>{{ file.fileName }}</span>
                  <el-tag size="small" type="info" style="margin-left: auto">
                    {{ formatFileSize(file.size) }}
                  </el-tag>
                </el-menu-item>
                <el-empty v-if="logFiles.length === 0" description="暂无日志文件" />
              </el-menu>
            </el-scrollbar>
          </el-card>
        </el-col>

        <!-- 右侧：日志内容 -->
        <el-col :span="18">
          <el-card shadow="hover">
            <template #header>
              <div class="card-header">
                <span class="card-title">
                  <el-icon><View /></el-icon>
                  日志内容
                </span>
                <div class="log-controls">
                  <el-select
                    v-model="logLevel"
                    placeholder="日志级别"
                    style="width: 120px; margin-right: 10px"
                    @change="loadLogContent"
                  >
                    <el-option label="全部" value="all" />
                    <el-option label="信息" value="info" />
                    <el-option label="警告" value="warn" />
                    <el-option label="错误" value="error" />
                  </el-select>
                  <el-input
                    v-model="searchKeyword"
                    placeholder="搜索关键词"
                    style="width: 200px; margin-right: 10px"
                    clearable
                    @input="handleSearch"
                  >
                    <template #prefix>
                      <el-icon><Search /></el-icon>
                    </template>
                  </el-input>
                  <el-input-number
                    v-model="logLimit"
                    :min="100"
                    :max="10000"
                    :step="100"
                    style="width: 120px; margin-right: 10px"
                    @change="loadLogContent"
                  />
                  <span style="color: #666; font-size: 12px; margin-right: 10px">行</span>
                  <el-button
                    type="primary"
                    :icon="Download"
                    @click="exportLog"
                    :disabled="!selectedLogFile"
                  >
                    导出
                  </el-button>
                  <el-button
                    type="danger"
                    :icon="Delete"
                    @click="deleteLogFile"
                    :disabled="!selectedLogFile"
                  >
                    删除
                  </el-button>
                </div>
              </div>
            </template>

            <div class="log-content-wrapper">
              <el-scrollbar height="600px" v-loading="loadingContent">
                <div class="log-content" ref="logContentRef">
                  <div
                    v-for="(line, index) in logLines"
                    :key="index"
                    :class="['log-line', getLogLineClass(line)]"
                  >
                    <span class="log-line-number">{{ index + 1 }}</span>
                    <span class="log-line-content">{{ line }}</span>
                  </div>
                  <el-empty v-if="logLines.length === 0" description="暂无日志内容" />
                </div>
              </el-scrollbar>
              <div class="log-footer">
                <span>共 {{ totalLines }} 行</span>
                <span v-if="selectedLogFile">文件大小: {{ formatFileSize(currentFileSize) }}</span>
              </div>
            </div>
          </el-card>
        </el-col>
      </el-row>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, nextTick } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import {
  Refresh,
  Delete,
  Back,
  Document,
  Files,
  View,
  Search,
  Download
} from '@element-plus/icons-vue'

const emit = defineEmits(['back'])

const loading = ref(false)
const cleaning = ref(false)
const loadingContent = ref(false)
const logFiles = ref([])
const selectedLogFile = ref('')
const logLines = ref([])
const totalLines = ref(0)
const currentFileSize = ref(0)
const logLevel = ref('all')
const searchKeyword = ref('')
const logLimit = ref(1000)
const logContentRef = ref(null)

const formatFileSize = (bytes) => {
  if (!bytes || bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i]
}

const getLogLineClass = (line) => {
  if (line.includes('[ERROR]')) return 'log-error'
  if (line.includes('[WARN]')) return 'log-warn'
  if (line.includes('[INFO]')) return 'log-info'
  return ''
}

const loadLogFiles = async () => {
  if (!window.electron || !window.electron.ipcRenderer) {
    ElMessage.error('IPC未加载')
    return
  }

  loading.value = true
  try {
    const result = await window.electron.ipcRenderer.invoke('get-log-files')
    if (result.success) {
      logFiles.value = result.files || []
      if (logFiles.value.length > 0 && !selectedLogFile.value) {
        selectedLogFile.value = logFiles.value[0].filePath
        await loadLogContent()
      }
    } else {
      ElMessage.error('加载日志文件列表失败: ' + (result.error || '未知错误'))
    }
  } catch (err) {
    ElMessage.error('加载日志文件列表失败: ' + err.message)
  } finally {
    loading.value = false
  }
}

const handleSelectLogFile = async (filePath) => {
  selectedLogFile.value = filePath
  await loadLogContent()
}

const loadLogContent = async () => {
  if (!selectedLogFile.value || !window.electron || !window.electron.ipcRenderer) {
    return
  }

  loadingContent.value = true
  try {
    const result = await window.electron.ipcRenderer.invoke('read-log-file', selectedLogFile.value, {
      limit: logLimit.value,
      level: logLevel.value,
      keyword: searchKeyword.value
    })

    if (result.success) {
      logLines.value = result.lines || []
      totalLines.value = result.totalLines || 0
      currentFileSize.value = result.fileSize || 0

      // 滚动到底部
      await nextTick()
      if (logContentRef.value) {
        const scrollbar = logContentRef.value.closest('.el-scrollbar__wrap')
        if (scrollbar) {
          scrollbar.scrollTop = scrollbar.scrollHeight
        }
      }
    } else {
      ElMessage.error('读取日志文件失败: ' + (result.error || '未知错误'))
    }
  } catch (err) {
    ElMessage.error('读取日志文件失败: ' + err.message)
  } finally {
    loadingContent.value = false
  }
}

const handleSearch = () => {
  // 防抖处理
  clearTimeout(handleSearch.timer)
  handleSearch.timer = setTimeout(() => {
    loadLogContent()
  }, 300)
}

const exportLog = async () => {
  if (!selectedLogFile.value || !window.electron || !window.electron.ipcRenderer) {
    return
  }

  try {
    const result = await window.electron.ipcRenderer.invoke('export-log-file', selectedLogFile.value)
    if (result.success) {
      ElMessage.success(`日志已导出到: ${result.filePath}`)
    } else {
      ElMessage.error('导出日志失败: ' + (result.error || '未知错误'))
    }
  } catch (err) {
    ElMessage.error('导出日志失败: ' + err.message)
  }
}

const deleteLogFile = async () => {
  if (!selectedLogFile.value) return

  const selectedFile = logFiles.value.find(f => f.filePath === selectedLogFile.value)
  if (!selectedFile) return

  try {
    await ElMessageBox.confirm(
      `确定要删除日志文件 "${selectedFile.fileName}" 吗？`,
      '确认删除',
      {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        type: 'warning'
      }
    )

    if (!window.electron || !window.electron.ipcRenderer) {
      ElMessage.error('IPC未加载')
      return
    }

    const result = await window.electron.ipcRenderer.invoke('delete-log-file', selectedLogFile.value)
    if (result.success) {
      ElMessage.success('日志文件已删除')
      selectedLogFile.value = ''
      logLines.value = []
      await loadLogFiles()
    } else {
      ElMessage.error('删除日志文件失败: ' + (result.error || '未知错误'))
    }
  } catch (err) {
    if (err !== 'cancel') {
      ElMessage.error('删除日志文件失败: ' + err.message)
    }
  }
}

const cleanupLogFiles = async () => {
  try {
    await ElMessageBox.confirm(
      '确定要清理30天前的旧日志文件吗？',
      '确认清理',
      {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        type: 'warning'
      }
    )

    if (!window.electron || !window.electron.ipcRenderer) {
      ElMessage.error('IPC未加载')
      return
    }

    cleaning.value = true
    const result = await window.electron.ipcRenderer.invoke('cleanup-log-files', 30)
    if (result.success) {
      ElMessage.success(`已清理 ${result.deletedCount || 0} 个旧日志文件`)
      selectedLogFile.value = ''
      logLines.value = []
      await loadLogFiles()
    } else {
      ElMessage.error('清理日志文件失败: ' + (result.error || '未知错误'))
    }
  } catch (err) {
    if (err !== 'cancel') {
      ElMessage.error('清理日志文件失败: ' + err.message)
    }
  } finally {
    cleaning.value = false
  }
}

const goBack = () => {
  emit('back')
}

onMounted(() => {
  loadLogFiles()
})
</script>

<style lang="stylus" scoped>
.log-manager-page
  width 100vw
  height 100vh
  overflow-y auto
  background linear-gradient(135deg, #667eea 0%, #764ba2 100%)
  display flex
  flex-direction column

.page-header
  background rgba(255, 255, 255, 0.95)
  box-shadow 0 2px 8px rgba(0, 0, 0, 0.1)
  padding 20px 30px
  z-index 100

  .header-content
    max-width 1400px
    margin 0 auto
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
          color #333
          font-weight 600

        .subtitle
          margin 5px 0 0 0
          font-size 14px
          color #666

    .header-actions
      display flex
      gap 10px

.page-content
  flex 1
  padding 30px
  max-width 1400px
  margin 0 auto
  width 100%

  .card-header
    display flex
    justify-content space-between
    align-items center

    .card-title
      display flex
      align-items center
      gap 8px
      font-size 18px
      font-weight 600
      color #333

    .file-count
      color #666
      font-size 14px

    .log-controls
      display flex
      align-items center

.log-file-menu
  border none

  :deep(.el-menu-item)
    display flex
    align-items center
    gap 8px

.log-content-wrapper
  .log-content
    font-family 'Consolas', 'Monaco', 'Courier New', monospace
    font-size 12px
    line-height 1.6

    .log-line
      display flex
      padding 2px 0
      border-bottom 1px solid #f0f0f0

      &.log-error
        background-color #fef0f0
        color #f56c6c

      &.log-warn
        background-color #fdf6ec
        color #e6a23c

      &.log-info
        background-color #f0f9ff
        color #409eff

      .log-line-number
        min-width 60px
        color #999
        text-align right
        padding-right 10px
        user-select none

      .log-line-content
        flex 1
        word-break break-all

  .log-footer
    display flex
    justify-content space-between
    padding 10px 0
    color #666
    font-size 12px
    border-top 1px solid #e4e7ed
    margin-top 10px
</style>

