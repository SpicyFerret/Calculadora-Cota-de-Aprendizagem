# Meia-noite no horário de Brasília (UTC-3) = 03:00 UTC
resource "aws_cloudwatch_event_rule" "meia_noite" {
  name                = "cota-aprendiz-atualiza-cbo-diario"
  description         = "Dispara a atualização diária da base CBO à meia-noite (BRT)"
  schedule_expression = "cron(0 3 * * ? *)"
}

resource "aws_cloudwatch_event_target" "lambda" {
  rule = aws_cloudwatch_event_rule.meia_noite.name
  arn  = aws_lambda_function.atualiza_cbo.arn
}

resource "aws_lambda_permission" "eventbridge" {
  statement_id  = "AllowEventBridge"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.atualiza_cbo.function_name
  principal     = "events.amazonaws.com"
  source_arn    = aws_cloudwatch_event_rule.meia_noite.arn
}
