<template>
  <el-dialog
    v-model="dialogVisible"
    title="应用更新"
    width="600px"
    :close-on-click-modal="false"
    :close-on-press-escape="false"
    :show-close="!downloading && !downloaded"
  >
    <div class="update-dialog-content">
      <!-- 检查更新中 -->
      <div v-if="status === 'checking'" class="update-status">
        <el-icon class="status-icon checking"><Loading /></el-icon>
        <p>正在检查更新...</p>
      </div>

      <!-- 发现新版本 -->
      <div v-if="status === 'available'" class="update-status">
        <el-icon class="status-icon available"><Download /></el-icon>
        <h3>发现新版本 {{ updateInfo.version }}</h3>
        <p v-if="updateInfo.releaseDate" class="release-date">
          发布日期: {{ formatDate(updateInfo.releaseDate) }}
        </p>
        <div v-if="updateInfo.releaseNotes" class="release-notes">
          <h4>更新内容:</h4>
          <div v-html="formatReleaseNotes(updateInfo.releaseNotes)"></div>
        </div>
        <el-button type="primary" :icon="Download" @click="handleDownload" :loading="downloading">
          {{ downloading ? '下载中...' : '立即下载' }}
        </el-button>
      </div>

      <!-- 下载进度 -->
      <div v-if="status === 'downloading'" class="update-status">
        <el-icon class="status-icon downloading"><Loading /></el-icon>
        <h3>正在下载更新...</h3>
        <el-progress
          :percentage="downloadProgress"
          :status="downloadProgress === 100 ? 'success' : undefined"
          :stroke-width="8"
        />
        <div class="progress-info">
          <span>{{ formatBytes(downloadTransferred) }} / {{ formatBytes(downloadTotal) }}</span>
          <span v-if="downloadSpeed > 0">{{ formatBytes(downloadSpeed) }}/s</span>
        </div>
      </div>

      <!-- 下载完成 -->
      <div v-if="status === 'downloaded'" class="update-status">
        <el-icon class="status-icon downloaded"><CircleCheck /></el-icon>
        <h3>更新下载完成</h3>
        <p>更新将在应用重启后安装</p>
        <div class="update-actions">
          <el-button @click="handleLater">稍后重启</el-button>
          <el-button type="primary" :icon="RefreshRight" @click="handleRestart">
            立即重启并安装
          </el-button>
        </div>
      </div>

      <!-- 已是最新版本 -->
      <div v-if="status === 'not-available'" class="update-status">
        <el-icon class="status-icon not-available"><CircleCheck /></el-icon>
        <h3>当前已是最新版本</h3>
        <p>版本号: {{ currentVersion }}</p>
      </div>

      <!-- 错误 -->
      <div v-if="status === 'error'" class="update-status">
        <el-icon class="status-icon error"><CircleClose /></el-icon>
        <h3>更新检查失败</h3>
        <p class="error-message">{{ errorMessage }}</p>
        <el-button type="primary" @click="handleRetry">重试</el-button>
      </div>
    </div>
  </el-dialog>
</template>

<script setup>
import { ref, watch, onMounted, onUnmounted } from 'vue'
import { ElMessage } from 'element-plus'
import {
  Loading,
  Download,
  CircleCheck,
  CircleClose,
  RefreshRight
} from '@element-plus/icons-vue'

const props = defineProps({
  modelValue: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits(['update:modelValue'])

const dialogVisible = ref(false)
const status = ref('idle') // idle, checking, available, downloading, downloaded, not-available, error
const updateInfo = ref(null)
const currentVersion = ref('')
const downloading = ref(false)
const downloaded = ref(false)
const downloadProgress = ref(0)
const downloadTransferred = ref(0)
const downloadTotal = ref(0)
const downloadSpeed = ref(0)
const errorMessage = ref('')

let updateListeners = []

watch(() => props.modelValue, (val) => {
  dialogVisible.value = val
  if (val) {
    loadCurrentVersion()
  }
})

watch(dialogVisible, (val) => {
  emit('update:modelValue', val)
})

const loadCurrentVersion = async () => {
  if (!window.electron || !window.electron.ipcRenderer) return

  try {
    const result = await window.electron.ipcRenderer.invoke('get-app-version')
    currentVersion.value = result.version
  } catch (err) {
    console.error('获取版本号失败:', err)
  }
}

const formatDate = (date) => {
  if (!date) return ''
  const d = new Date(date)
  return d.toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  })
}

const formatReleaseNotes = (notes) => {
  if (!notes) return ''
  if (typeof notes === 'string') {
    return notes.replace(/\n/g, '<br>')
  }
  if (Array.isArray(notes)) {
    return notes.join('<br>')
  }
  return String(notes)
}

const formatBytes = (bytes) => {
  if (!bytes || bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i]
}

const handleDownload = async () => {
  if (!window.electron || !window.electron.ipcRenderer) {
    ElMessage.error('IPC未加载')
    return
  }

  downloading.value = true
  status.value = 'downloading'

  try {
    const result = await window.electron.ipcRenderer.invoke('download-update')
    if (!result.success) {
      status.value = 'error'
      errorMessage.value = result.error || '下载失败'
      downloading.value = false
      ElMessage.error('下载更新失败: ' + (result.error || '未知错误'))
    }
  } catch (err) {
    status.value = 'error'
    errorMessage.value = err.message
    downloading.value = false
    ElMessage.error('下载更新失败: ' + err.message)
  }
}

const handleRestart = async () => {
  if (!window.electron || !window.electron.ipcRenderer) {
    ElMessage.error('IPC未加载')
    return
  }

  try {
    await window.electron.ipcRenderer.invoke('quit-and-install')
  } catch (err) {
    ElMessage.error('重启失败: ' + err.message)
  }
}

const handleLater = () => {
  dialogVisible.value = false
  downloaded.value = false
}

const handleRetry = async () => {
  await checkForUpdates()
}

const checkForUpdates = async () => {
  if (!window.electron || !window.electron.ipcRenderer) {
    ElMessage.error('IPC未加载')
    return
  }

  status.value = 'checking'
  errorMessage.value = ''

  try {
    const result = await window.electron.ipcRenderer.invoke('check-for-updates')
    if (result.success) {
      if (result.updateInfo) {
        updateInfo.value = result.updateInfo
        status.value = 'available'
      } else {
        status.value = 'not-available'
      }
    } else {
      status.value = 'error'
      errorMessage.value = result.error || '检查更新失败'
    }
  } catch (err) {
    status.value = 'error'
    errorMessage.value = err.message
    ElMessage.error('检查更新失败: ' + err.message)
  }
}

onMounted(() => {
  if (!window.electron || !window.electron.ipcRenderer) return

  // 监听更新事件
  const listeners = [
    window.electron.ipcRenderer.on('update-checking', () => {
      status.value = 'checking'
    }),
    window.electron.ipcRenderer.on('update-available', (event, info) => {
      updateInfo.value = info
      status.value = 'available'
    }),
    window.electron.ipcRenderer.on('update-not-available', (event, info) => {
      currentVersion.value = info.version
      status.value = 'not-available'
    }),
    window.electron.ipcRenderer.on('update-error', (event, error) => {
      status.value = 'error'
      errorMessage.value = error.message || '更新失败'
    }),
    window.electron.ipcRenderer.on('update-download-progress', (event, progress) => {
      downloadProgress.value = Math.round(progress.percent || 0)
      downloadTransferred.value = progress.transferred || 0
      downloadTotal.value = progress.total || 0
      downloadSpeed.value = progress.bytesPerSecond || 0
    }),
    window.electron.ipcRenderer.on('update-downloaded', (event, info) => {
      downloading.value = false
      downloaded.value = true
      status.value = 'downloaded'
      updateInfo.value = info
      ElMessage.success('更新下载完成，可以重启应用安装更新')
    })
  ]

  updateListeners = listeners
})

onUnmounted(() => {
  // 清理监听器
  updateListeners.forEach(cleanup => {
    if (typeof cleanup === 'function') {
      cleanup()
    }
  })
  updateListeners = []
})

// 暴露方法供外部调用
defineExpose({
  checkForUpdates
})
</script>

<style lang="stylus" scoped>
.update-dialog-content
  padding 20px 0

.update-status
  text-align center
  padding 20px 0

  .status-icon
    font-size 64px
    margin-bottom 20px

    &.checking
      color #409eff
      animation rotate 2s linear infinite

    &.available
      color #67c23a

    &.downloading
      color #409eff
      animation rotate 2s linear infinite

    &.downloaded
      color #67c23a

    &.not-available
      color #909399

    &.error
      color #f56c6c

  h3
    margin 10px 0
    font-size 18px
    color #333

  p
    margin 10px 0
    color #666

  .release-date
    font-size 14px
    color #999

  .release-notes
    text-align left
    margin 20px 0
    padding 15px
    background #f5f7fa
    border-radius 6px
    max-height 200px
    overflow-y auto

    h4
      margin 0 0 10px 0
      font-size 14px
      color #333

    div
      font-size 13px
      color #666
      line-height 1.6

  .progress-info
    display flex
    justify-content space-between
    margin-top 10px
    font-size 12px
    color #999

  .update-actions
    display flex
    justify-content center
    gap 10px
    margin-top 20px

  .error-message
    color #f56c6c
    margin 15px 0

@keyframes rotate
  from
    transform rotate(0deg)
  to
    transform rotate(360deg)
</style>

