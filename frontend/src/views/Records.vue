<template>
  <div class="records-page">
    <el-card class="page-card">
      <template #header>
        <div class="card-header">
          <span>授权记录</span>
          <el-upload
            :http-request="handleUpload"
            :before-upload="beforeUpload"
            :show-file-list="false"
            accept=".xlsx,.xls"
          >
            <template #trigger>
              <el-button type="primary">
                <el-icon><Upload /></el-icon>
                上传Excel
              </el-button>
            </template>
          </el-upload>
        </div>
      </template>

      <el-form :inline="true" :model="searchForm" class="search-form">
        <el-form-item label="人员姓名">
          <el-input v-model="searchForm.person_name" placeholder="请输入人员姓名" clearable />
        </el-form-item>
        <el-form-item label="标记状态">
          <el-select v-model="searchForm.is_marked_deletion" placeholder="请选择" clearable>
            <el-option label="未标记" :value="false" />
            <el-option label="已标记删除" :value="true" />
          </el-select>
        </el-form-item>
        <el-form-item>
          <el-button type="primary" @click="loadRecords">查询</el-button>
          <el-button @click="resetSearch">重置</el-button>
        </el-form-item>
      </el-form>

      <el-table :data="recordsList" v-loading="loading" border stripe>
        <el-table-column prop="person_name" label="人员姓名" width="120" />
        <el-table-column prop="host_ip" label="主机IP" width="150" />
        <el-table-column prop="host_name" label="主机名称" min-width="200" />
        <el-table-column prop="host_network" label="主机网络" width="200" />
        <el-table-column prop="host_group" label="主机组" width="180" />
        <el-table-column prop="protocol" label="协议" width="100">
          <template #default="{ row }">
            <el-tag v-if="row.protocol" :type="getProtocolTag(row.protocol)">
              {{ row.protocol }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="account_login_name" label="账户登录名" width="120" />
        <el-table-column prop="check_time" label="检查时间" width="180">
          <template #default="{ row }">
            {{ formatDateTime(row.check_time) }}
          </template>
        </el-table-column>
        <el-table-column prop="is_marked_deletion" label="标记状态" width="100">
          <template #default="{ row }">
            <el-tag :type="row.is_marked_deletion ? 'danger' : 'success'">
              {{ row.is_marked_deletion ? '已标记' : '正常' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="deletion_reason" label="删除原因" min-width="200" />
        <el-table-column label="操作" width="180" fixed="right">
          <template #default="{ row }">
            <el-button
              v-if="!row.is_marked_deletion"
              type="danger"
              link
              size="small"
              @click="handleMarkDeletion(row)"
            >
              标记删除
            </el-button>
            <el-button
              v-else
              type="success"
              link
              size="small"
              @click="handleUnmarkDeletion(row)"
            >
              取消标记
            </el-button>
          </template>
        </el-table-column>
      </el-table>

      <div class="pagination-container">
        <el-pagination
          v-model:current-page="pagination.page"
          v-model:page-size="pagination.size"
          :total="pagination.total"
          :page-sizes="[10, 20, 50, 100]"
          layout="total, sizes, prev, pager, next, jumper"
          @size-change="loadRecords"
          @current-change="loadRecords"
        />
      </div>
    </el-card>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Upload } from '@element-plus/icons-vue'
import { getRecords, uploadExcel, markDeletion, unmarkDeletion } from '@/api/records'
import request from '@/utils/request'
import dayjs from 'dayjs'

const loading = ref(false)
const recordsList = ref([])
const uploading = ref(false)

const searchForm = reactive({
  person_name: '',
  is_marked_deletion: null
})

const pagination = reactive({
  page: 1,
  size: 20,
  total: 0
})

const getProtocolTag = (protocol) => {
  const map = {
    SSH: 'success',
    RDP: 'warning',
    MySQL: 'danger',
    MYSQL: 'danger'
  }
  return map[protocol?.toUpperCase()] || 'info'
}

const formatDateTime = (date) => {
  return dayjs(date).format('YYYY-MM-DD HH:mm:ss')
}

const loadRecords = async () => {
  loading.value = true
  try {
    const params = {
      ...searchForm,
      skip: (pagination.page - 1) * pagination.size,
      limit: pagination.size
    }
    // 清理null值
    Object.keys(params).forEach(key => {
      if (params[key] === null || params[key] === '') {
        delete params[key]
      }
    })
    
    const res = await getRecords(params)
    recordsList.value = res.data || res
    // 如果返回的是数组，直接使用；如果有total字段，使用它
    if (Array.isArray(res)) {
      pagination.total = res.length
    } else if (res.total !== undefined) {
      pagination.total = res.total
    }
  } catch (error) {
    console.error(error)
  } finally {
    loading.value = false
  }
}

const resetSearch = () => {
  searchForm.person_name = ''
  searchForm.is_marked_deletion = null
  pagination.page = 1
  loadRecords()
}

const beforeUpload = (file) => {
  const isExcel = file.type === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
    file.type === 'application/vnd.ms-excel'
  if (!isExcel) {
    ElMessage.error('只能上传Excel文件！')
    return false
  }
  const isLt10M = file.size / 1024 / 1024 < 10
  if (!isLt10M) {
    ElMessage.error('文件大小不能超过10MB！')
    return false
  }
  return true
}

const handleUpload = async (options) => {
  uploading.value = true
  try {
    const res = await uploadExcel(options.file)
    ElMessage.success(res.message || '上传成功')
    loadRecords()
  } catch (error) {
    console.error(error)
  } finally {
    uploading.value = false
  }
}

const handleMarkDeletion = async (row) => {
  try {
    const { value } = await ElMessageBox.prompt('请输入删除原因', '标记删除', {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      inputPlaceholder: '请输入删除原因'
    })
    
    await markDeletion(row.id, value)
    ElMessage.success('标记成功')
    loadRecords()
  } catch (error) {
    if (error !== 'cancel') {
      console.error(error)
    }
  }
}

const handleUnmarkDeletion = async (row) => {
  try {
    await ElMessageBox.confirm('确定要取消标记吗？', '提示', {
      type: 'warning'
    })
    await unmarkDeletion(row.id)
    ElMessage.success('取消标记成功')
    loadRecords()
  } catch (error) {
    if (error !== 'cancel') {
      console.error(error)
    }
  }
}

onMounted(() => {
  loadRecords()
})
</script>

<style lang="stylus" scoped>
.records-page
  // 样式已在全局定义
</style>

