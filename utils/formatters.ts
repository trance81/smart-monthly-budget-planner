
export const formatCurrency = (amount: number): string => {
  return new Intl.NumberFormat('ko-KR').format(amount) + '원';
};

export const formatDate = (date: Date): { today: string; month: string } => {
  const days = ['일', '월', '화', '수', '목', '금', '토'];
  const year = date.getFullYear();
  const month = date.getMonth() + 1;
  const day = date.getDate();
  const dayOfWeek = days[date.getDay()];

  return {
    today: `${year}년 ${month}월 ${day}일 (${dayOfWeek})`,
    month: `${year}년 ${month}월`,
  };
};
