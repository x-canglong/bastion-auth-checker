<template>
  <el-dialog
    v-model="dialogVisible"
    title="历史文件管理"
    width="900px"
    :close-on-click-modal="false"
    destroy-on-close
  >
    <div class="history-manager-content">
      <div class="toolbar">
        <el-button type="primary" :icon="Refresh" @click="loadHistoryFiles" :loading="loading">
          刷新
        </el-button>
        <el-button type="danger" :icon="Delete" @click="cleanupInvalidFiles" :loading="cleaning">
          清理无效文件
        </el-button>
        <div class="file-count">
          共 {{ historyFiles.length }} 个历史文件
        </div>
      </div>

      <el-table
        :data="historyFiles"
        v-loading="loading"
        stripe
        border
        style="width: 100%"
        max-height="500"
      >
        <el-table-column prop="fileName" label="文件名" min-width="200" show-overflow-tooltip />
        <el-table-column prop="fileHash" label="文件Hash" width="120">
          <template #default="{ row }">
            <el-text truncated style="max-width: 120px">{{ row.fileHash.substring(0, 8) }}...</el-text>
          </template>
        </el-table-column>
        <el-table-column prop="timestamp" label="检查时间" width="180">
          <template #default="{ row }">
            {{ formatTimestamp(row.timestamp) }}
          </template>
        </el-table-column>
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
        <el-table-column label="操作" width="120" fixed="right">
          <template #default="{ row }">
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
    </div>

    <template #footer>
      <div class="dialog-footer">
        <el-button @click="handleClose">关闭</el-button>
      </div>
    </template>
  </el-dialog>
</template>

<script setup>
import { ref, watch } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Refresh, Delete } from '@element-plus/icons-vue'

const props = defineProps({
  modelValue: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits(['update:modelValue'])

const dialogVisible = ref(false)
const loading = ref(false)
const cleaning = ref(false)
const historyFiles = ref([])

watch(() => props.modelValue, (val) => {
  dialogVisible.value = val
  if (val) {
    loadHistoryFiles()
  }
})

watch(dialogVisible, (val) => {
  emit('update:modelValue', val)
})

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

const handleClose = () => {
  dialogVisible.value = false
}
</script>

<style lang="stylus" scoped>
.history-manager-content
  padding 10px 0

.toolbar
  display flex
  align-items center
  gap 10px
  margin-bottom 15px

  .file-count
    margin-left auto
    color #666
    font-size 14px
</style>

