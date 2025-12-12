<template>
  <div class="rules-page">
    <el-card class="page-card">
      <template #header>
        <div class="card-header">
          <span>规则管理</span>
          <el-button type="primary" @click="handleCreate">
            <el-icon><Plus /></el-icon>
            新增规则
          </el-button>
        </div>
      </template>

      <el-form :inline="true" :model="searchForm" class="search-form">
        <el-form-item label="规则类型">
          <el-select v-model="searchForm.rule_type" placeholder="请选择" clearable>
            <el-option label="运维人员" value="ops_personnel" />
            <el-option label="长时间设置" value="long_time_setting" />
            <el-option label="生产环境规则" value="prod_env_pattern" />
            <el-option label="主数据库IP" value="master_db_ips" />
          </el-select>
        </el-form-item>
        <el-form-item>
          <el-button type="primary" @click="loadRules">查询</el-button>
          <el-button @click="resetSearch">重置</el-button>
        </el-form-item>
      </el-form>

      <el-table :data="rulesList" v-loading="loading" border stripe>
        <el-table-column prop="id" label="ID" width="80" />
        <el-table-column prop="rule_type" label="规则类型" width="150">
          <template #default="{ row }">
            <el-tag :type="getRuleTypeTag(row.rule_type)">
              {{ getRuleTypeName(row.rule_type) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="rule_key" label="规则键名" width="200" />
        <el-table-column prop="rule_value" label="规则值">
          <template #default="{ row }">
            <pre class="rule-value">{{ JSON.stringify(row.rule_value, null, 2) }}</pre>
          </template>
        </el-table-column>
        <el-table-column prop="description" label="描述" />
        <el-table-column prop="created_at" label="创建时间" width="180">
          <template #default="{ row }">
            {{ formatDateTime(row.created_at) }}
          </template>
        </el-table-column>
        <el-table-column label="操作" width="180" fixed="right">
          <template #default="{ row }">
            <el-button type="primary" link size="small" @click="handleEdit(row)">
              编辑
            </el-button>
            <el-button type="danger" link size="small" @click="handleDelete(row)">
              删除
            </el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <!-- 新增/编辑对话框 -->
    <el-dialog
      v-model="dialogVisible"
      :title="dialogTitle"
      width="600px"
      @close="resetForm"
    >
      <el-form :model="form" :rules="rules" ref="formRef" label-width="120px">
        <el-form-item label="规则类型" prop="rule_type">
          <el-select v-model="form.rule_type" placeholder="请选择" @change="handleRuleTypeChange">
            <el-option label="运维人员" value="ops_personnel" />
            <el-option label="长时间设置" value="long_time_setting" />
            <el-option label="生产环境规则" value="prod_env_pattern" />
            <el-option label="主数据库IP" value="master_db_ips" />
          </el-select>
        </el-form-item>
        <el-form-item label="规则键名" prop="rule_key">
          <el-input v-model="form.rule_key" placeholder="请输入规则键名" />
        </el-form-item>
        <el-form-item label="规则值" prop="rule_value">
          <el-input
            v-model="ruleValueText"
            type="textarea"
            :rows="8"
            placeholder='请输入JSON格式的规则值，例如：{"personnel": ["张三", "李四"]}'
            @blur="parseRuleValue"
          />
        </el-form-item>
        <el-form-item label="描述" prop="description">
          <el-input v-model="form.description" type="textarea" :rows="2" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" @click="handleSubmit">确定</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Plus } from '@element-plus/icons-vue'
import { getRules, createRule, updateRule, deleteRule } from '@/api/rules'
import dayjs from 'dayjs'

const loading = ref(false)
const rulesList = ref([])
const dialogVisible = ref(false)
const dialogTitle = ref('新增规则')
const formRef = ref(null)
const ruleValueText = ref('')

const searchForm = reactive({
  rule_type: ''
})

const form = reactive({
  id: null,
  rule_type: '',
  rule_key: '',
  rule_value: {},
  description: ''
})

const rules = {
  rule_type: [{ required: true, message: '请选择规则类型', trigger: 'change' }],
  rule_key: [{ required: true, message: '请输入规则键名', trigger: 'blur' }],
  rule_value: [{ required: true, message: '请输入规则值', trigger: 'blur' }]
}

const getRuleTypeName = (type) => {
  const map = {
    ops_personnel: '运维人员',
    long_time_setting: '长时间设置',
    prod_env_pattern: '生产环境规则',
    master_db_ips: '主数据库IP'
  }
  return map[type] || type
}

const getRuleTypeTag = (type) => {
  const map = {
    ops_personnel: 'success',
    long_time_setting: 'warning',
    prod_env_pattern: 'danger',
    master_db_ips: 'info'
  }
  return map[type] || ''
}

const formatDateTime = (date) => {
  return dayjs(date).format('YYYY-MM-DD HH:mm:ss')
}

const loadRules = async () => {
  loading.value = true
  try {
    const res = await getRules(searchForm.rule_type || null)
    rulesList.value = res.data || res
  } catch (error) {
    console.error(error)
  } finally {
    loading.value = false
  }
}

const resetSearch = () => {
  searchForm.rule_type = ''
  loadRules()
}

const handleCreate = () => {
  dialogTitle.value = '新增规则'
  resetForm()
  dialogVisible.value = true
}

const handleEdit = (row) => {
  dialogTitle.value = '编辑规则'
  form.id = row.id
  form.rule_type = row.rule_type
  form.rule_key = row.rule_key
  form.rule_value = row.rule_value
  form.description = row.description
  ruleValueText.value = JSON.stringify(row.rule_value, null, 2)
  dialogVisible.value = true
}

const handleDelete = async (row) => {
  try {
    await ElMessageBox.confirm('确定要删除这条规则吗？', '提示', {
      type: 'warning'
    })
    await deleteRule(row.id)
    ElMessage.success('删除成功')
    loadRules()
  } catch (error) {
    if (error !== 'cancel') {
      console.error(error)
    }
  }
}

const handleRuleTypeChange = () => {
  // 根据规则类型设置默认值
  if (form.rule_type === 'ops_personnel') {
    ruleValueText.value = JSON.stringify({ personnel: [] }, null, 2)
    form.rule_value = { personnel: [] }
  } else if (form.rule_type === 'long_time_setting') {
    ruleValueText.value = JSON.stringify({ days: 30 }, null, 2)
    form.rule_value = { days: 30 }
  } else if (form.rule_type === 'prod_env_pattern') {
    ruleValueText.value = JSON.stringify({ type: 'contains', value: '' }, null, 2)
    form.rule_value = { type: 'contains', value: '' }
  } else if (form.rule_type === 'master_db_ips') {
    ruleValueText.value = JSON.stringify({ single_ips: [], ip_ranges: [] }, null, 2)
    form.rule_value = { single_ips: [], ip_ranges: [] }
  }
}

const parseRuleValue = () => {
  try {
    form.rule_value = JSON.parse(ruleValueText.value)
  } catch (error) {
    ElMessage.error('规则值格式错误，请输入有效的JSON')
  }
}

const resetForm = () => {
  form.id = null
  form.rule_type = ''
  form.rule_key = ''
  form.rule_value = {}
  form.description = ''
  ruleValueText.value = ''
  formRef.value?.resetFields()
}

const handleSubmit = async () => {
  try {
    await formRef.value.validate()
    parseRuleValue()
    
    if (form.id) {
      await updateRule(form.id, {
        rule_value: form.rule_value,
        description: form.description
      })
      ElMessage.success('更新成功')
    } else {
      await createRule({
        rule_type: form.rule_type,
        rule_key: form.rule_key,
        rule_value: form.rule_value,
        description: form.description
      })
      ElMessage.success('创建成功')
    }
    
    dialogVisible.value = false
    loadRules()
  } catch (error) {
    console.error(error)
  }
}

onMounted(() => {
  loadRules()
})
</script>

<style lang="stylus" scoped>
.rules-page
  .rule-value
    margin 0
    font-size 12px
    white-space pre-wrap
    word-break break-all
    max-height 100px
    overflow auto
</style>

