// 合成正样本：while(true) 体内无 break —— 工作量若受输入控制即消耗滥用面
async function waitForJob(jobId) {
  while (true) {
    await checkJobStatus(jobId);
  }
}

export { waitForJob };
