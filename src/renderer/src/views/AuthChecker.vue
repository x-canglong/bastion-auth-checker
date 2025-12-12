<template>
  <div class="auth-checker">
    <div class="header">
      <h1>授权检查工具</h1>
      <p class="subtitle">自动检查Excel表格中的授权项目，标记不符合常规逻辑的项目</p>
    </div>

    <div class="content">
      <!-- 主页面：文件操作 -->
      <div class="main-panel">
        <div class="file-section">
          <div class="file-info">
            <label>选择的文件:</label>
            <span class="file-path">{{ selectedFile || '未选择文件' }}</span>
          </div>
          <div class="action-buttons">
            <el-button type="primary" @click="selectFile">选择Excel文件</el-button>
            <el-button type="success" @click="openConfigDialog">规则配置</el-button>
            <el-button 
              type="primary" 
              @click="processFile" 
              :disabled="!selectedFile || processing"
              :loading="processing"
            >
              {{ processing ? '处理中...' : '开始检查' }}
            </el-button>
          </div>
        </div>

        <!-- 检查结果子页面 -->
        <div v-if="result" class="result-panel">
          <el-tabs v-model="activeTab" type="border-card">
            <!-- 统计信息Tab -->
            <el-tab-pane label="统计信息" name="summary">
              <div class="summary">
                <div class="summary-item">
                  <span class="label">总工作表数:</span>
                  <span class="value">{{ result.summary.totalSheets }}</span>
                </div>
                <div class="summary-item">
                  <span class="label">总记录数:</span>
                  <span class="value">{{ result.summary.totalRecords }}</span>
                </div>
                <div class="summary-item highlight">
                  <span class="label">标记删除数:</span>
                  <span class="value">{{ result.summary.markedForDeletion }}</span>
                </div>
              </div>

              <div v-if="Object.keys(result.summary.byReason).length > 0" class="reason-breakdown">
                <h3>删除原因统计:</h3>
                <ul>
                  <li v-for="(count, reason) in result.summary.byReason" :key="reason">
                    {{ reason }}: {{ count }} 条
                  </li>
                </ul>
              </div>
            </el-tab-pane>

            <!-- 预览Tab（按sheet分组） -->
            <el-tab-pane label="预览" name="preview">
              <div class="preview-controls">
                <el-radio-group v-model="previewFilter" size="small">
                  <el-radio-button label="all">全部记录</el-radio-button>
                  <el-radio-button label="marked">仅标记删除</el-radio-button>
                </el-radio-group>
              </div>
              <el-tabs v-model="activeSheetTab" type="card" v-if="result.preview && Object.keys(result.preview).length > 0">
                <el-tab-pane 
                  v-for="(records, sheetName) in result.preview" 
                  :key="sheetName"
                  :label="`${sheetName} (${getFilteredRecords(records).length}/${records.length}条)`"
                  :name="sheetName"
                >
                  <div class="table-container">
                    <el-table 
                      :data="getFilteredRecords(records)" 
                      stripe
                      border
                      style="width: 100%"
                      max-height="600"
                      :row-class-name="getRowClassName"
                    >
                      <el-table-column prop="主机IP" label="主机IP" width="150" />
                      <el-table-column prop="主机名称" label="主机名称" width="200" />
                      <el-table-column prop="协议" label="协议" width="100" />
                      <el-table-column prop="账户登录名" label="账户登录名" width="150" />
                      <el-table-column prop="删除原因" label="删除原因" width="250" />
                      <el-table-column label="删除标记" width="120" fixed="right">
                        <template #default="scope">
                          <el-switch
                            v-model="scope.row.shouldDelete"
                            active-text="删除"
                            inactive-text="保留"
                            @change="handleDeleteMarkChange(scope.row)"
                          />
                        </template>
                      </el-table-column>
                    </el-table>
                  </div>
                </el-tab-pane>
              </el-tabs>
              <div v-else class="empty-preview">
                <p>暂无记录</p>
              </div>
            </el-tab-pane>
          </el-tabs>

          <div class="save-section">
            <el-button type="success" size="large" @click="saveResult">
              保存结果到Excel文件
            </el-button>
          </div>
        </div>

        <!-- 错误提示 -->
        <el-alert
          v-if="error"
          :title="error"
          type="error"
          :closable="true"
          @close="error = ''"
          style="margin-top: 20px"
        />
      </div>
    </div>

    <!-- 规则配置弹框 -->
    <el-dialog
      v-model="configDialogVisible"
      title="检查规则配置"
      width="800px"
      :close-on-click-modal="false"
    >
      <div class="config-content">
        <div class="config-section">
          <label>运维岗位人员名单（每行一个，支持部分匹配）:</label>
          <el-input
            v-model="config.opsPersonnelText"
            type="textarea"
            :rows="5"
            placeholder="例如：&#10;王礼鑫&#10;王鹏辉&#10;杨志智&#10;张涛"
          />
        </div>

        <div class="config-section">
          <label>生产环境主机名称规则（每行一个，支持正则表达式）:</label>
          <el-input
            v-model="config.productionHostPatternsText"
            type="textarea"
            :rows="5"
            placeholder="例如：&#10;prd&#10;pehx-outpub-"
          />
        </div>

        <div class="config-section">
          <label>生产环境主机名称排除规则（每行一个，不匹配这些规则）:</label>
          <el-input
            v-model="config.productionHostExcludePatternsText"
            type="textarea"
            :rows="3"
            placeholder="例如：&#10;uat"
          />
        </div>

        <div class="config-section">
          <label>主数据库IP地址列表（每行一个）:</label>
          <el-input
            v-model="config.masterDbIPsText"
            type="textarea"
            :rows="5"
            placeholder="例如：&#10;192.168.240.181&#10;192.168.240.156"
          />
        </div>

        <div class="config-section">
          <label>主数据库IP地址范围:</label>
          <div class="ip-range">
            <el-input v-model="config.masterDbIPRange.start" placeholder="起始IP" />
            <span> - </span>
            <el-input v-model="config.masterDbIPRange.end" placeholder="结束IP" />
          </div>
        </div>
      </div>

      <template #footer>
        <div class="dialog-footer">
          <el-button @click="loadConfig">加载配置</el-button>
          <el-button @click="saveConfig">保存配置</el-button>
          <el-button type="primary" @click="configDialogVisible = false">确定</el-button>
        </div>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import { ElMessage } from 'element-plus'

const selectedFile = ref('')
const processing = ref(false)
const result = ref(null)
const error = ref('')
const configDialogVisible = ref(false)
const activeTab = ref('summary')
const activeSheetTab = ref('')
const cacheKey = ref('')
const previewFilter = ref('marked')

const config = reactive({
  opsPersonnelText: '王礼鑫\n王鹏辉\n杨志智\n张涛',
  productionHostPatternsText: 'prd\npehx-outpub-',
  productionHostExcludePatternsText: 'uat',
  masterDbIPsText: '192.168.240.181\n192.168.240.156',
  masterDbIPRange: {
    start: '192.168.240.150',
    end: '192.168.240.190'
  }
})

// 将配置文本转换为数组
const getConfigObject = () => {
  return {
    opsPersonnel: config.opsPersonnelText.split('\n').filter(s => s.trim()),
    productionHostPatterns: config.productionHostPatternsText.split('\n').filter(s => s.trim()),
    productionHostExcludePatterns: config.productionHostExcludePatternsText.split('\n').filter(s => s.trim()),
    masterDbIPs: config.masterDbIPsText.split('\n').filter(s => s.trim()),
    masterDbIPRange: {
      start: String(config.masterDbIPRange.start || ''),
      end: String(config.masterDbIPRange.end || '')
    }
  }
}

// 检查IPC是否可用
const checkIPC = () => {
  if (!window.electron || !window.electron.ipcRenderer) {
    error.value = 'IPC未加载，请刷新页面重试'
    return false
  }
  return true
}

// 打开配置弹框
const openConfigDialog = () => {
  configDialogVisible.value = true
}

// 加载配置
const loadConfig = async () => {
  if (!checkIPC()) return
  
  try {
    const savedConfig = await window.electron.ipcRenderer.invoke('load-config')
    config.opsPersonnelText = savedConfig.opsPersonnel.join('\n')
    config.productionHostPatternsText = savedConfig.productionHostPatterns.join('\n')
    config.productionHostExcludePatternsText = (savedConfig.productionHostExcludePatterns || []).join('\n')
    config.masterDbIPsText = savedConfig.masterDbIPs.join('\n')
    config.masterDbIPRange = savedConfig.masterDbIPRange || config.masterDbIPRange
    ElMessage.success('配置已加载')
  } catch (err) {
    error.value = '加载配置失败: ' + err.message
    ElMessage.error('加载配置失败: ' + err.message)
  }
}

// 保存配置
const saveConfig = async () => {
  if (!checkIPC()) return
  
  try {
    const configObj = getConfigObject()
    const saveResult = await window.electron.ipcRenderer.invoke('save-config', configObj)
    if (saveResult.success) {
      ElMessage.success('配置已保存')
    } else {
      error.value = '保存配置失败: ' + saveResult.error
      ElMessage.error('保存配置失败: ' + saveResult.error)
    }
  } catch (err) {
    error.value = '保存配置失败: ' + err.message
    ElMessage.error('保存配置失败: ' + err.message)
  }
}

// 选择文件
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

// 处理文件
const processFile = async () => {
  if (!checkIPC()) return
  if (!selectedFile.value) return
  
  processing.value = true
  error.value = ''
  
  try {
    console.log('开始处理文件:', selectedFile.value)
    const configObj = getConfigObject()
    console.log('配置对象:', configObj)
    
    const processResult = await window.electron.ipcRenderer.invoke('process-excel', selectedFile.value, configObj)
    console.log('处理结果:', processResult)
    
    if (!processResult) {
      throw new Error('未收到处理结果，请检查控制台错误信息')
    }
    
    if (processResult.success) {
      result.value = processResult
      cacheKey.value = processResult.cacheKey
      // 设置第一个sheet为默认激活的tab
      if (processResult.preview && Object.keys(processResult.preview).length > 0) {
        activeSheetTab.value = Object.keys(processResult.preview)[0]
      }
      activeTab.value = 'preview'
      ElMessage.success('处理完成')
    } else {
      const errorMsg = processResult.error || '处理失败'
      error.value = errorMsg
      ElMessage.error(errorMsg)
      console.error('处理失败:', errorMsg)
    }
  } catch (err) {
    const errorMsg = '处理文件失败: ' + (err.message || String(err))
    error.value = errorMsg
    ElMessage.error(errorMsg)
    console.error('处理文件异常:', err)
    console.error('错误堆栈:', err.stack)
  } finally {
    processing.value = false
  }
}

// 处理删除标记变化
const handleDeleteMarkChange = async (row) => {
  if (!checkIPC() || !cacheKey.value) return
  
  try {
    const updateResult = await window.electron.ipcRenderer.invoke(
      'update-delete-mark',
      cacheKey.value,
      row.sheetName,
      row.originalIndex,
      row.shouldDelete
    )
    
    if (updateResult.success) {
      // 更新统计信息
      result.value.summary = updateResult.summary
      // 更新预览数据
      result.value.preview = updateResult.preview
      // 更新当前行的删除标记显示
      row['删除标记'] = row.shouldDelete ? '删除' : ''
    } else {
      ElMessage.error(updateResult.error || '更新失败')
      // 恢复原状态
      row.shouldDelete = !row.shouldDelete
    }
  } catch (err) {
    ElMessage.error('更新删除标记失败: ' + err.message)
    // 恢复原状态
    row.shouldDelete = !row.shouldDelete
  }
}

// 获取筛选后的记录
const getFilteredRecords = (records) => {
  if (previewFilter.value === 'all') {
    return records
  } else {
    return records.filter(r => r.shouldDelete)
  }
}

// 获取行的类名（用于高亮标记删除的行）
const getRowClassName = ({ row }) => {
  return row.shouldDelete ? 'marked-row' : ''
}

// 保存结果
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

// 页面加载时自动加载配置
onMounted(() => {
  setTimeout(() => {
    if (window.electron && window.electron.ipcRenderer) {
      loadConfig()
    } else {
      error.value = 'IPC未加载，请刷新页面重试'
      console.error('window.electron.ipcRenderer is not available')
    }
  }, 100)
})
</script>

<style scoped>
.auth-checker {
  padding: 20px;
  max-width: 1400px;
  margin: 0 auto;
  height: 100vh;
  overflow: auto;
}

.header {
  margin-bottom: 30px;
  text-align: center;
}

.header h1 {
  margin: 0 0 10px 0;
  color: #333;
}

.subtitle {
  color: #666;
  margin: 0;
}

.content {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.main-panel {
  background: #f9f9f9;
  border-radius: 8px;
  padding: 20px;
  border: 1px solid #ddd;
}

.file-section {
  margin-bottom: 20px;
}

.file-info {
  margin-bottom: 15px;
}

.file-info label {
  font-weight: bold;
  margin-right: 10px;
}

.file-path {
  color: #666;
  font-family: monospace;
  word-break: break-all;
}

.action-buttons {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
}

.result-panel {
  margin-top: 20px;
}

.summary {
  display: flex;
  gap: 30px;
  margin-bottom: 20px;
  padding: 15px;
  background: white;
  border-radius: 4px;
}

.summary-item {
  display: flex;
  flex-direction: column;
}

.summary-item .label {
  font-size: 12px;
  color: #666;
  margin-bottom: 5px;
}

.summary-item .value {
  font-size: 24px;
  font-weight: bold;
  color: #333;
}

.summary-item.highlight .value {
  color: #f44336;
}

.reason-breakdown {
  margin-bottom: 20px;
  padding: 15px;
  background: white;
  border-radius: 4px;
}

.reason-breakdown h3 {
  margin-top: 0;
  color: #555;
}

.reason-breakdown ul {
  margin: 10px 0 0 0;
  padding-left: 20px;
}

.table-container {
  margin-top: 10px;
}

.empty-preview {
  text-align: center;
  padding: 40px;
  color: #999;
}

.save-section {
  text-align: center;
  padding-top: 20px;
  margin-top: 20px;
  border-top: 1px solid #ddd;
}

.config-content {
  padding: 10px 0;
}

.config-section {
  margin-bottom: 20px;
}

.config-section label {
  display: block;
  margin-bottom: 8px;
  font-weight: bold;
  color: #555;
}

.ip-range {
  display: flex;
  align-items: center;
  gap: 10px;
}

.ip-range span {
  color: #666;
}

.dialog-footer {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
}

.preview-controls {
  margin-bottom: 15px;
  display: flex;
  justify-content: flex-end;
}

:deep(.marked-row) {
  background-color: #fff1f0;
}

:deep(.marked-row:hover) {
  background-color: #ffe7e6 !important;
}
</style>
