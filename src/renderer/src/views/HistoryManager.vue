<template>
  <div class="history-manager-page">
    <!-- 顶部导航栏 -->
    <div class="page-header">
      <div class="header-content">
        <div class="logo-section">
          <el-icon class="logo-icon"><Folder /></el-icon>
          <div class="logo-text">
            <h1>历史文件管理</h1>
            <p class="subtitle">查看和管理历史检查文件</p>
          </div>
        </div>
        <div class="header-actions">
          <el-button type="primary" :icon="Refresh" @click="loadHistoryFiles" :loading="loading">
            刷新
          </el-button>
          <el-button type="danger" :icon="Delete" @click="cleanupInvalidFiles" :loading="cleaning">
            清理无效文件
          </el-button>
          <el-button type="info" :icon="Back" @click="goBack">
            返回
          </el-button>
        </div>
      </div>
    </div>

    <!-- 主内容区 -->
    <div class="page-content">
      <el-card shadow="hover">
        <template #header>
          <div class="card-header">
            <span class="card-title">
              <el-icon><Files /></el-icon>
              历史文件列表
            </span>
            <div class="file-count">
              共 {{ historyFiles.length }} 个历史文件
            </div>
          </div>
        </template>

        <el-table
          :data="historyFiles"
          v-loading="loading"
          stripe
          border
          style="width: 100%"
          :height="600"
          :row-class-name="getRowClassName"
        >
          <el-table-column type="expand">
            <template #default="{ row }">
              <div v-if="row.summary" class="check-result-detail">
                <el-descriptions :column="2" border size="small">
                  <el-descriptions-item label="总工作表数">
                    <el-tag type="info">{{ row.summary.totalSheets || 0 }}</el-tag>
                  </el-descriptions-item>
                  <el-descriptions-item label="总记录数">
                    <el-tag type="primary">{{ row.summary.totalRecords || 0 }}</el-tag>
                  </el-descriptions-item>
                  <el-descriptions-item label="标记删除数">
                    <el-tag type="danger">{{ row.summary.markedForDeletion || 0 }}</el-tag>
                  </el-descriptions-item>
                  <el-descriptions-item label="正常记录数">
                    <el-tag type="success">{{ row.summary.normalRecords || 0 }}</el-tag>
                  </el-descriptions-item>
                </el-descriptions>
                <div v-if="row.summary.byReason && Object.keys(row.summary.byReason).length > 0" class="delete-reasons">
                  <h4>删除原因统计：</h4>
                  <div class="reason-tags">
                    <el-tag
                      v-for="(count, reason) in row.summary.byReason"
                      :key="reason"
                      type="warning"
                      size="small"
                      style="margin: 4px"
                    >
                      {{ reason }}: {{ count }}
                    </el-tag>
                  </div>
                </div>
                <div v-else class="no-reasons">
                  <el-text type="info">无删除原因统计</el-text>
                </div>
              </div>
              <div v-else class="no-summary">
                <el-text type="info">该历史文件无检查结果记录</el-text>
              </div>
            </template>
          </el-table-column>
          <el-table-column prop="fileName" label="原始文件名" min-width="250" show-overflow-tooltip>
            <template #default="{ row }">
              <el-icon style="margin-right: 5px; color: #409eff"><Document /></el-icon>
              {{ row.fileName }}
            </template>
          </el-table-column>
          <el-table-column prop="fileHash" label="文件Hash" width="270">
            <!-- <template #default="{ row }">
              <el-text truncated style="max-width: 120px">{{ row.fileHash.substring(0, 8) }}...</el-text>
            </template> -->
          </el-table-column>
          <el-table-column prop="timestamp" label="检查时间" width="180">
            <template #default="{ row }">
              {{ formatTimestamp(row.timestamp) }}
            </template>
          </el-table-column>
          <!-- <el-table-column label="检查结果" width="220">
            <template #default="{ row }">
              <div v-if="row.summary" class="check-result-summary">
                <div class="summary-row">
                  <span class="summary-label">工作表:</span>
                  <el-tag type="info" size="small">{{ row.summary.totalSheets || 0 }}</el-tag>
                </div>
                <div class="summary-row">
                  <span class="summary-label">记录:</span>
                  <el-tag type="primary" size="small">{{ row.summary.totalRecords || 0 }}</el-tag>
                </div>
                <div class="summary-row">
                  <span class="summary-label">删除:</span>
                  <el-tag type="danger" size="small">{{ row.summary.markedForDeletion || 0 }}</el-tag>
                </div>
                <div class="summary-row">
                  <span class="summary-label">正常:</span>
                  <el-tag type="success" size="small">{{ row.summary.normalRecords || 0 }}</el-tag>
                </div>
              </div>
              <el-text v-else type="info" size="small">无记录</el-text>
            </template>
          </el-table-column> -->
          <el-table-column prop="fileSize" label="文件大小" width="100">
            <template #default="{ row }">
              {{ formatFileSize(row.fileSize) }}
            </template>
          </el-table-column>
          <el-table-column prop="exists" label="状态" width="80">
            <template #default="{ row }">
              <el-tag :type="row.exists ? 'success' : 'danger'" size="small">
                {{ row.exists ? '存在' : '缺失' }}
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column label="操作" width="200" fixed="right">
            <template #default="{ row }">
              <el-button
                type="primary"
                :icon="View"
                size="small"
                @click="previewFile(row)"
                :disabled="!row.exists"
              >
                查看
              </el-button>
              <el-button
                type="danger"
                :icon="Delete"
                size="small"
                @click="deleteFile(row)"
                :disabled="!row.exists"
              >
                删除
              </el-button>
            </template>
          </el-table-column>
        </el-table>
      </el-card>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Refresh, Delete, Back, Folder, Files, Document, View, Download } from '@element-plus/icons-vue'

const emit = defineEmits(['back'])

const loading = ref(false)
const cleaning = ref(false)
const historyFiles = ref([])

const formatTimestamp = (timestamp) => {
  const date = new Date(timestamp)
  return date.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  })
}

const formatFileSize = (bytes) => {
  if (!bytes || bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i]
}

const loadHistoryFiles = async () => {
  if (!window.electron || !window.electron.ipcRenderer) {
    ElMessage.error('IPC未加载')
    return
  }

  loading.value = true
  try {
    const result = await window.electron.ipcRenderer.invoke('get-history-files')
    if (result.success) {
      historyFiles.value = result.files || []
      ElMessage.success('历史文件列表已加载')
    } else {
      ElMessage.error('加载历史文件列表失败: ' + (result.error || '未知错误'))
    }
  } catch (err) {
    ElMessage.error('加载历史文件列表失败: ' + err.message)
  } finally {
    loading.value = false
  }
}

const previewFile = async (file) => {
  if (!window.electron || !window.electron.ipcRenderer) {
    ElMessage.error('IPC未加载')
    return
  }

  try {
    const result = await window.electron.ipcRenderer.invoke('preview-history-file', file.filePath)
    if (result.success) {
      ElMessage.success('已在文件管理器中打开文件')
    } else {
      ElMessage.error('预览文件失败: ' + (result.error || '未知错误'))
    }
  } catch (err) {
    ElMessage.error('预览文件失败: ' + err.message)
  }
}

const downloadFile = async (file) => {
  if (!window.electron || !window.electron.ipcRenderer) {
    ElMessage.error('IPC未加载')
    return
  }

  try {
    const result = await window.electron.ipcRenderer.invoke('download-history-file', file.filePath, file.fileName)
    if (result.success) {
      ElMessage.success(`文件已保存到: ${result.filePath}`)
    } else {
      ElMessage.error('下载文件失败: ' + (result.error || '未知错误'))
    }
  } catch (err) {
    ElMessage.error('下载文件失败: ' + err.message)
  }
}

const deleteFile = async (file) => {
  try {
    await ElMessageBox.confirm(
      `确定要删除历史文件 "${file.fileName}" 吗？`,
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

    const result = await window.electron.ipcRenderer.invoke('delete-history-file', file.filePath)
    if (result.success) {
      ElMessage.success('文件已删除')
      await loadHistoryFiles()
    } else {
      ElMessage.error('删除文件失败: ' + (result.error || '未知错误'))
    }
  } catch (err) {
    if (err !== 'cancel') {
      ElMessage.error('删除文件失败: ' + err.message)
    }
  }
}

const cleanupInvalidFiles = async () => {
  try {
    await ElMessageBox.confirm(
      '确定要清理所有无效的历史文件记录吗？这将删除索引中指向不存在文件的记录。',
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
    const result = await window.electron.ipcRenderer.invoke('cleanup-history-index')
    if (result.success) {
      ElMessage.success(`已清理 ${result.cleanedCount || 0} 个无效记录`)
      await loadHistoryFiles()
    } else {
      ElMessage.error('清理失败: ' + (result.error || '未知错误'))
    }
  } catch (err) {
    if (err !== 'cancel') {
      ElMessage.error('清理失败: ' + err.message)
    }
  } finally {
    cleaning.value = false
  }
}

const goBack = () => {
  emit('back')
}

const getRowClassName = ({ row }) => {
  if (row.summary && row.summary.markedForDeletion > 0) {
    return 'has-deletion-row'
  }
  return ''
}

onMounted(() => {
  loadHistoryFiles()
})
</script>

<style lang="stylus" scoped>
.history-manager-page
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

.check-result-detail
  padding 15px
  background #f8f9fa

  .delete-reasons
    margin-top 15px

    h4
      margin 0 0 10px 0
      font-size 14px
      color #333

    .reason-tags
      display flex
      flex-wrap wrap
      gap 8px

  .no-reasons, .no-summary
    padding 10px
    text-align center
    color #999

.check-result-summary
  display flex
  flex-direction column
  gap 4px

  .summary-row
    display flex
    align-items center
    gap 6px
    font-size 12px

    .summary-label
      color #666
      min-width 40px

:deep(.has-deletion-row)
  background-color #fef0f0

  &:hover
    background-color #fde2e2
</style>

