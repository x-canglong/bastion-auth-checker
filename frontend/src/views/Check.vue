<template>
  <div class="check-page">
    <el-row :gutter="20">
      <el-col :span="24">
        <el-card class="page-card">
          <template #header>
            <div class="card-header">
              <span>执行检查</span>
              <el-button type="primary" @click="handleExecuteCheck" :loading="checking">
                <el-icon><Search /></el-icon>
                执行检查
              </el-button>
            </div>
          </template>

          <el-alert
            title="检查说明"
            type="info"
            :closable="false"
            show-icon
            style="margin-bottom: 20px"
          >
            <template #default>
              <div>
                <p>系统将根据以下规则进行检查：</p>
                <ul style="margin: 10px 0; padding-left: 20px">
                  <li>检查重复授权，保留一条，其他标记删除</li>
                  <li>检查非运维人员的长时间权限（超过设定天数）</li>
                  <li>检查非运维人员的生产环境权限</li>
                  <li>检查非运维人员的主数据库权限</li>
                </ul>
              </div>
            </template>
          </el-alert>

          <el-descriptions :column="2" border v-if="checkResult">
            <el-descriptions-item label="检查时间">
              {{ formatDateTime(checkResult.check_time) }}
            </el-descriptions-item>
            <el-descriptions-item label="总记录数">
              {{ checkResult.total_records }}
            </el-descriptions-item>
            <el-descriptions-item label="标记删除数">
              <el-tag type="danger">{{ checkResult.marked_deletions }}</el-tag>
            </el-descriptions-item>
            <el-descriptions-item label="状态">
              <el-tag :type="checkResult.success ? 'success' : 'danger'">
                {{ checkResult.success ? '成功' : '失败' }}
              </el-tag>
            </el-descriptions-item>
            <el-descriptions-item label="消息" :span="2">
              {{ checkResult.message }}
            </el-descriptions-item>
          </el-descriptions>
        </el-card>
      </el-col>
    </el-row>

    <el-row :gutter="20" style="margin-top: 20px">
      <el-col :span="24">
        <el-card class="page-card">
          <template #header>
            <div class="card-header">
              <span>检查历史</span>
            </div>
          </template>

          <el-table :data="historyList" v-loading="historyLoading" border stripe>
            <el-table-column prop="id" label="ID" width="80" />
            <el-table-column prop="check_time" label="检查时间" width="180">
              <template #default="{ row }">
                {{ formatDateTime(row.check_time) }}
              </template>
            </el-table-column>
            <el-table-column prop="total_records" label="总记录数" width="120" />
            <el-table-column prop="marked_deletions" label="标记删除数" width="120">
              <template #default="{ row }">
                <el-tag type="danger">{{ row.marked_deletions }}</el-tag>
              </template>
            </el-table-column>
            <el-table-column prop="created_at" label="创建时间" width="180">
              <template #default="{ row }">
                {{ formatDateTime(row.created_at) }}
              </template>
            </el-table-column>
            <el-table-column label="操作" width="100">
              <template #default="{ row }">
                <el-button type="primary" link size="small" @click="viewHistoryDetail(row)">
                  详情
                </el-button>
              </template>
            </el-table-column>
          </el-table>

          <div class="pagination-container">
            <el-pagination
              v-model:current-page="historyPagination.page"
              v-model:page-size="historyPagination.size"
              :total="historyPagination.total"
              :page-sizes="[10, 20, 50]"
              layout="total, sizes, prev, pager, next, jumper"
              @size-change="loadHistory"
              @current-change="loadHistory"
            />
          </div>
        </el-card>
      </el-col>
    </el-row>

    <!-- 历史详情对话框 -->
    <el-dialog v-model="detailDialogVisible" title="检查历史详情" width="600px">
      <el-descriptions :column="1" border v-if="historyDetail">
        <el-descriptions-item label="ID">{{ historyDetail.id }}</el-descriptions-item>
        <el-descriptions-item label="检查时间">
          {{ formatDateTime(historyDetail.check_time) }}
        </el-descriptions-item>
        <el-descriptions-item label="总记录数">{{ historyDetail.total_records }}</el-descriptions-item>
        <el-descriptions-item label="标记删除数">
          <el-tag type="danger">{{ historyDetail.marked_deletions }}</el-tag>
        </el-descriptions-item>
        <el-descriptions-item label="创建时间">
          {{ formatDateTime(historyDetail.created_at) }}
        </el-descriptions-item>
      </el-descriptions>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import { Search } from '@element-plus/icons-vue'
import { executeCheck, getCheckHistory, getCheckHistoryDetail } from '@/api/check'
import dayjs from 'dayjs'

const checking = ref(false)
const checkResult = ref(null)
const historyLoading = ref(false)
const historyList = ref([])
const detailDialogVisible = ref(false)
const historyDetail = ref(null)

const historyPagination = reactive({
  page: 1,
  size: 20,
  total: 0
})

const formatDateTime = (date) => {
  return dayjs(date).format('YYYY-MM-DD HH:mm:ss')
}

const handleExecuteCheck = async () => {
  checking.value = true
  try {
    const res = await executeCheck()
    checkResult.value = res.data || res
    ElMessage.success('检查完成')
    loadHistory()
  } catch (error) {
    console.error(error)
  } finally {
    checking.value = false
  }
}

const loadHistory = async () => {
  historyLoading.value = true
  try {
    const params = {
      skip: (historyPagination.page - 1) * historyPagination.size,
      limit: historyPagination.size
    }
    const res = await getCheckHistory(params)
    historyList.value = res.data || res
    if (Array.isArray(res)) {
      historyPagination.total = res.length
    } else if (res.total !== undefined) {
      historyPagination.total = res.total
    }
  } catch (error) {
    console.error(error)
  } finally {
    historyLoading.value = false
  }
}

const viewHistoryDetail = async (row) => {
  try {
    const res = await getCheckHistoryDetail(row.id)
    historyDetail.value = res.data || res
    detailDialogVisible.value = true
  } catch (error) {
    console.error(error)
  }
}

onMounted(() => {
  loadHistory()
})
</script>

<style lang="stylus" scoped>
.check-page
  // 样式已在全局定义
</style>

