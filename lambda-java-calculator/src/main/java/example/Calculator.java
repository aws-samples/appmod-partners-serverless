package example;

import com.amazonaws.services.lambda.runtime.Context;
import com.amazonaws.services.lambda.runtime.RequestHandler;

public class Calculator implements RequestHandler<CalculatorInput, Integer> {
    @Override
    public Integer handleRequest(CalculatorInput input, Context context) {
        Integer output = input.getN1() + input.getN2();

        System.out.println(input);
        System.out.println(output);

        return output;
    }
}
